'use strict'

const Qs = require('querystring')
const Url = require('url')

/**
 * internals
 * To wrap private methods and properties
 *   when bound to a instantiated object of this class
 */
const internals = {
}

/**
* @class HarBuilder
*/
class HarBuilder {
  /**
  * @constructor
  */
  constructor () {
    this._requestsMap = new Map()
    this._harEntries = new Map()  // after request/response processed
  }

  /**
   * @public
   * @method addRequest
   *
  */
  addRequest (reqObj, cookies) {
    if (reqObj.initiator.type === 'parser') return // chrome pretty messages
    const startTs = new Date() // response.request.startTime

    const request = {
      method: reqObj.request.method,
      url: reqObj.request.url,
      cookies: cookies,
      headers: reqObj.request.headers,
      httpVersion: '',
      queryString: internals.harQueryString(reqObj.request.url),
      postData: {},
      headersSize: -1,
      bodySize: -1,
      timestamp: startTs
    }

    if (reqObj.request.hasOwnProperty('postData')) {
      request.postData = internals.harPostdata(reqObj.request.postData)
    }

    // since there may be many updated (redirect, etc...) to a
    // single requestId, keep as an array for later response comparasion
    let setRequestArr = this._requestsMap.get(reqObj.requestId)
    if (setRequestArr === undefined) {
      setRequestArr = []
    } else if (reqObj.hasOwnProperty('redirectResponse')) {
       // if this is a new request created from a redirect response, save it too
      const prevReq = setRequestArr[setRequestArr.length - 1]
      prevReq.redirectResponse = reqObj.redirectResponse
    }

    setRequestArr.push(request)
    this._requestsMap.set(reqObj.requestId, setRequestArr)
  }

  /**
   * @public
   * @method addResponse
   *
  */
  addResponse (respObj, respBodyObj, cookies) {
    if (this._requestsMap.has(respObj.requestId) === false) return

    const requestArr = this._requestsMap.get(respObj.requestId)
    this._requestsMap.delete(respObj.requestId) // clean up

    if (respObj.hasOwnProperty('errorText')) {
      internals.addFailedResponse.call(this, respObj)
    } else {
      // there may be an array of requests (e.g. redirected) from
      // multiple responses that all have the same `requestId`
      requestArr.forEach(internals.addResponse.bind(this,
                            respObj, respBodyObj, cookies))
    }

    return this._harEntries.size // temporary functionality
  }

  /**
   * @public
   * @method addResponse
   *
  */
  async finishRequest (loadingObj) {
    const requestId = loadingObj.requestId
    if (this._harEntries.has(requestId) === false) return

    const harEntry = this._harEntries.get(requestId)
    this._harEntries.delete(requestId) // clean up

    const rcStr = await `${JSON.stringify(harEntry)}\n`
    return rcStr
  }
}

/********************************************************/

/**
 * @private
 * @method addResponse
*/
internals.addResponse = function (respObj, respBodyObj, cookies, reqObj) {
  const regExVer = /HTTP\/\d+\.\d+/

  if (respBodyObj.base64Encoded === true) {
    console.log(`content len = ${respBodyObj.body.length}, base64encoding ignored`)
    return 0
  }

  let respMsg = respObj.response
  let redirectUrl = ''
  if (reqObj.hasOwnProperty('redirectResponse')) {
    // use the redirect response ignoring the one passed in
    redirectUrl = respMsg.url // before replacing, get this url
    respMsg = reqObj.redirectResponse
  }

  const response = {
    status: respMsg.status,
    statusText: respMsg.statusText,
    cookies: cookies,
    headers: respMsg.headers,
    content: {
      size: respBodyObj.body.length,
      mimeType: respMsg.headers['Content-Type'],
      text: respBodyObj.body,
      encoding: respBodyObj.base64Encoding ? 'base64' : 'ascii'
    },
    redirectURL: redirectUrl,
    headersSize: respMsg.headersText === undefined ? -1
                  : respMsg.headersText.length,
    bodySize: respBodyObj.body.length
  }

  const httpRespVerArr = regExVer.exec(respMsg.headersText)
  response.httpVersion = (httpRespVerArr === null)
                  ? respMsg.protocol.toUpperCase() : httpRespVerArr[0]

  const httpReqVerArr = regExVer.exec(respMsg.requestHeadersText)

  // default to use the response HTTP version if the requestHeadersText is null
  reqObj.httpVersion = (httpReqVerArr === null)
                  ? response.httpVersion : httpReqVerArr[0]

  internals.addHarEntry.call(this, respObj.requestId, reqObj, response)
}

internals.addFailedResponse = function (failedObj) {
  const response = {
    status: -1,
    statusText: failedObj.errorText,
    httpVersion: '',
    cookies: [],
    headers: [],
    content: {},
    redirectURL: '',
    headersSize: -1,
    bodySize: -1
  }

  internals.addHarEntry.call(this, failedObj.requestId, failedObj, response)
}

/**
 * @private
 * @method addHarEntry
*/
internals.addHarEntry = function (requestId, reqObj, response) {
  const startTs = reqObj.timestamp
  const timings = {
    send: 0,
    wait: 0,
    receive: 0
  }

  const harRequest = {
    startedDateTime: new Date(startTs).toISOString(),
    time: 0,
    request: reqObj,
    response: response,
    cache: {},
    timings: timings
  }

  // save this entry
  this._harEntries.set(requestId, harRequest)
}

/**
 * @private
 * @method harQueryString - har queryString is represented as an Array
 * @returns {Array}
*/
internals.harQueryString = function (url) {
  const queryString = Url.parse(url, true).query
  const queryStringArr = internals.harConvertToPairs(queryString)

  return queryStringArr
}

/**
 * @private
 * @method harPostdata - har postdata is represented as a Object
 * @returns {Object}
*/
internals.harPostdata = function (postdataStr) {
  const postDataObj = Qs.parse(postdataStr)
  const postDataArr = internals.harConvertToPairs(postDataObj)

  // TODO calculate the mime type from request.headers['Content-Type']
  // e.g. 'application/x-www-form-urlencoded' = 'multipart/form-data'
  return {
    mimeType: 'multipart/form-data',
    // text : reqObj.request.postData,
    params: postDataArr
  }
}

/**
 * @private
 * @method harConvertToPairs
 * @returns {Object}
*/
internals.harConvertToPairs = function (pairsObject) {
  return Object.keys(pairsObject).map(key => {
    const pair = {
      name: key
    }

    if (pairsObject[key] !== undefined && pairsObject[key] !== null) {
      pair.value = pairsObject[key]
    }

    return pair
  })
}

module.exports = HarBuilder
