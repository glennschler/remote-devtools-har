'use strict'

const Qs = require('querystring')
const Url = require('url')

const DevToolsHelper = require('./DevToolsHelper')

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
class HarEntryBuilder extends DevToolsHelper {
  /**
  * @constructor
  */
  constructor (remoteDebugChrome) {
    super()
    this._parent = remoteDebugChrome
    this._requestsMap = new Map()
    this._harEntries = new Map()  // after request/response processed
    this._options = remoteDebugChrome.options
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
      request.postData = internals.harPostdata(reqObj.request.postData,
                                                request.headers)
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

    if (this.listenerCount(`event${reqObj.requestId}`) > 0) {
      // notify the responseHandler, which may have arrived before this
      // requestHandler finished for this requestId
      this.emitAsync(`event${reqObj.requestId}`)
    }
  }

  /**
   * @public
   * @method addResponse
   *
  */
  addResponse (respObj) {
    if (this._requestsMap.has(respObj.requestId) === false) {
      // sometimes (e.g. on http failure), the Network.loadingFailed
      // arrvies before Network.requestWillBeSent is finished waiting
      // for an async request out asking the devToolProtocol for the cookies
      this.once(`event${respObj.requestId}`,
              this.addResponse.bind(this, respObj))
      return
    }

    const entryObj = this._requestsMap.get(respObj.requestId)
    this._requestsMap.delete(respObj.requestId) // clean up

    // match the response obj to associated request object
    internals.addResponse.call(this, entryObj, respObj)
  }
}

/********************************************************/

/**
 * @private
 * @method addResponse
*/
internals.addResponse = function (entryObj, respObj) {
  const { networkDevTools } = this._parent
  const { requestArr, wallTime } = entryObj

  if (respObj.hasOwnProperty('errorText')) {
    internals.addFailedResponse.call(this, wallTime, requestArr[0], respObj)
    return
  }

  // check if should ignore filtered response attributes
  if (internals.ignoreRespOnFilters.call(this, respObj)) {
    return
  }

  // now request the body and cookies. Asynchronously
  const respBodyPromise = networkDevTools.retrieveResponseBody(respObj)
  const respCookiesPromise = networkDevTools.retrieveResponseCookies(respObj)
  const self = this

  // await for the body and cookies to both arrive
  Promise.all([respBodyPromise, respCookiesPromise])
    .then((respData) => {
      const respDataObj = {
        respBodyObj: respData[0],
        cookiesObj: respData[1],
        wallTime: wallTime
      }
      const addResponseDataFn =
              internals.addResponseData.bind(self, respDataObj, respObj)
      requestArr.forEach(addResponseDataFn)
      internals.finishRequest.call(self, { requestId: respObj.requestId })
    })
}

/**
 * @private
 * @method addResponseData - now that optional response data has been
 * retrieved, build the har entry
*/
internals.addResponseData = function (respDataObj, respObj, reqObj) {
  const { respBodyObj, cookiesObj } = respDataObj
  if (respBodyObj.base64Encoded === true && this._options.filters.ignoreRespBodyBase64) {
    return
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
    cookies: cookiesObj.cookies,
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

  // no need to bind to THIS context
  internals.applyHttpVersion(response, respMsg, reqObj)

  internals.addHarEntry.call(this, respObj.requestId, respDataObj.wallTime,
                              reqObj, response)
}

/**
 * @private
 * @method applyHttpVersion - apply http version string to the passed objects
*/
internals.applyHttpVersion = function (response, respMsg, reqObj) {
  const regExVer = /HTTP\/\d+\.\d+/
  const httpRespVerArr = regExVer.exec(respMsg.headersText)
  const httpReqVerArr = regExVer.exec(respMsg.requestHeadersText)

  response.httpVersion = (httpRespVerArr === null)
                  ? respMsg.protocol.toUpperCase() : httpRespVerArr[0]

  // default to use the response HTTP version if the requestHeadersText is null
  reqObj.httpVersion = (httpReqVerArr === null)
                  ? response.httpVersion : httpReqVerArr[0]
}

/**
 * @private
 * @method ignoreRespOnFilters - passed in options decide which
 * response urls, mimtypes, etc... to ignore
*/
internals.ignoreRespOnFilters = function (respObj) {
  const ignoreIsAMatch = function isaMatch (regexArray, strToTest) {
    return regexArray.some(rx => rx.test(strToTest))
  }

  const { filters } = this._options
  if (ignoreIsAMatch(filters.ignoreRespMime, respObj.response.mimeType)) {
    return true
  } else if (ignoreIsAMatch(filters.ignoreRespUrl, respObj.response.url)) {
    return true
  } else return false
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
  internals.finishRequest.call(this, { requestId: respObj.requestId })
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
  let entriesArr = this._harEntries.get(requestId)
  if (entriesArr === undefined) {
    entriesArr = []
  }

  entriesArr.push(harRequest)

  // save this entry
  this._harEntries.set(requestId, entriesArr)
}

/**
 * @private
 * @method internals.finishRequest
 *
*/
internals.finishRequest = function (loadingObj) {
  const requestId = loadingObj.requestId
  if (this._harEntries.has(requestId) === false) return

  const entriesArr = this._harEntries.get(requestId)
  this._harEntries.delete(requestId) // clean up

  const err = null
  const emitHarEntry = this._parent.emitAsync.bind(this._parent, 'harEntry')
  entriesArr.forEach(function emitEachHarEntry (entry) {
    emitHarEntry(err, entry)
  })
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
internals.harPostdata = function (postdataStr, headers) {
  function isConentUrlEncoded (headers) {
    return headers.hasOwnProperty('Content-Type') &&
      headers['Content-Type'].indexOf('application/x-www-form-urlencoded') >= 0
  }

  let postDataObj = { mimeType: headers['Content-Type'] }
  if (isConentUrlEncoded(headers)) {
    const qsParamsObj = Qs.parse(postdataStr)
    postDataObj.params = internals.harConvertToPairs(qsParamsObj)
  } else {
    postDataObj.text = postdataStr
  }

  return postDataObj
}

/**
 * @private
 * @method harConvertToPairs
 * @returns {Array}
*/
internals.harConvertToPairs = function (pairsObject) {
  const pairsMap = Object.keys(pairsObject).map(key => {
    const pair = {
      name: key
    }

    if (pairsObject[key] !== undefined && pairsObject[key] !== null) {
      pair.value = pairsObject[key]
    }

    return pair
  })

  return pairsMap  // an Array
}

module.exports = HarEntryBuilder
