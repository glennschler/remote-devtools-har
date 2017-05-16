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
* @class HarEntryBuilder
*/
class HarEntryBuilder {
  /**
  * @constructor
  */
  constructor (remoteDebugChrome) {
    this._parent = remoteDebugChrome
    this._requestsMap = new Map()
    this._harEntries = new Map()  // after request/response processed
  }

  /**
   * @public
   * @method destroy - clean up
  */
  destroy () {
    this._requestsMap.clear()
    this._harEntries.clear()
    this._harEntries = null
    this._requestsMap = null
    this._parent = null
  }

  /**
   * @public
   * @method addRequest
   *
  */
  addRequest (reqObj, cookies) {
    const request = {
      method: reqObj.request.method,
      url: reqObj.request.url,
      cookies: cookies,
      headers: reqObj.request.headers,
      httpVersion: '',
      queryString: internals.harQueryString(reqObj.request.url),
      postData: {},
      headersSize: -1,
      bodySize: -1
    }

    if (reqObj.request.hasOwnProperty('postData')) {
      request.postData = internals.harPostdata(reqObj.request.postData)
    }

    // since there may be many updated (redirect, etc...) to a
    // single requestId, keep as an array for later response comparasion
    let harEntry = this._requestsMap.get(reqObj.requestId)
    if (harEntry === undefined) {
      harEntry = {
        requestId: reqObj.requestId,
        wallTime: reqObj.wallTime,
        requestArr: []
      }
    } else if (reqObj.hasOwnProperty('redirectResponse')) {
      const { requestArr } = harEntry
       // if this is a new request created from a redirect response, save it too
      const prevReq = requestArr[requestArr.length - 1]
      prevReq.redirectResponse = reqObj.redirectResponse
    }

    harEntry.requestArr.push(request)
    this._requestsMap.set(reqObj.requestId, harEntry)
  }

  /**
   * @public
   * @method addResponse
   *
  */
  addResponse (respObj, respBodyObj, cookies) {
    if (this._requestsMap.has(respObj.requestId) === false) {
      // sometimes when failure, the Network.loadingFailed arrvies before
      // Network.requestWillBeSent is finished waiting for an async
      // request out asking the devToolProtocol for the cookies
      // Deal with that issue. TODO better than this
      if (!respObj.hasOwnProperty('retryCount')) respObj.retryCount = 0
      if (++respObj.retryCount <= 2) {
        setTimeout(function (iRespObj, iRespBodyObj, iCookies) {
          this.addResponse(iRespObj, iRespBodyObj, iCookies)
        }.bind(this), 100, respObj, respBodyObj, cookies)
      }
      return
    }

    const entryObj = this._requestsMap.get(respObj.requestId)
    const { requestArr, wallTime } = entryObj
    this._requestsMap.delete(respObj.requestId) // clean up

    if (respObj.hasOwnProperty('errorText')) {
      internals.addFailedResponse.call(this, wallTime, requestArr[0], respObj)
    } else {
      // there may be an array of requests (e.g. redirected) from
      // multiple responses that all have the same `requestId`
      requestArr.forEach(internals.addResponse.bind(this,
                            wallTime, respObj, respBodyObj, cookies))
    }

    this.finishRequest({ requestId: respObj.requestId })
  }

  /**
   * @public
   * @method finishRequest
   *
  */
  finishRequest (loadingObj) {
    const requestId = loadingObj.requestId
    if (this._harEntries.has(requestId) === false) return

    const entriesArr = this._harEntries.get(requestId)
    this._harEntries.delete(requestId) // clean up

    const err = null
    const emitHarEntry = this._parent.emitAsync.bind(this._parent, 'HarEntry')
    entriesArr.forEach(function (entry) {
      emitHarEntry(err, entry)
    })
  }
}

/********************************************************/

/**
 * @private
 * @method addResponse
*/
internals.addResponse = function (wallTime, respObj, respBodyObj, cookies, reqObj) {
  if (respBodyObj.base64Encoded === true) {
    // console.log(`content len = ${respBodyObj.body.length}, base64encoding ignored`)
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

  const regExVer = /HTTP\/\d+\.\d+/
  const httpRespVerArr = regExVer.exec(respMsg.headersText)
  response.httpVersion = (httpRespVerArr === null)
                  ? respMsg.protocol.toUpperCase() : httpRespVerArr[0]

  const httpReqVerArr = regExVer.exec(respMsg.requestHeadersText)

  // default to use the response HTTP version if the requestHeadersText is null
  reqObj.httpVersion = (httpReqVerArr === null)
                  ? response.httpVersion : httpReqVerArr[0]

  internals.addHarEntry.call(this, respObj.requestId, wallTime,
                              reqObj, response)
}

/**
 * @private
 * @method addFailedResponse
*/
internals.addFailedResponse = function (wallTime, reqObj, respObj) {
  const response = {
    status: -1,
    statusText: respObj.errorText,
    httpVersion: '',
    cookies: [],
    headers: [],
    content: {},
    redirectURL: '',
    headersSize: -1,
    bodySize: -1
  }

  const { requestId } = respObj
  internals.addHarEntry.call(this, requestId, wallTime, reqObj, response)
}

/**
 * @private
 * @method addHarEntry
*/
internals.addHarEntry = function (requestId, wallTime, reqObj, response) {
  const timings = {
    send: 0,
    wait: 0,
    receive: 0
  }

  const harRequest = {
    startedDateTime: new Date(wallTime * 1000).toISOString(),
    time: 0,
    request: reqObj,
    response: response,
    cache: {},
    timings: timings
  }

  // there will be multiple entries with same requestId when redirected
  let entriesArr = this._harEntries.get(reqObj.requestId)
  if (entriesArr === undefined) {
    entriesArr = []
  }

  entriesArr.push(harRequest)

  // save this entry
  this._harEntries.set(requestId, entriesArr)
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

module.exports = HarEntryBuilder
