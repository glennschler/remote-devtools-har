'use strict'

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
    this._entries = []
  }

  /**
   * @public
   * @method addRequest
   *
  */
  addRequest (reqObj, cookies) {
    const startTs = new Date() // respObj.response.request.startTime

    const request = {
      method: reqObj.request.method,
      url: reqObj.request.url,
      cookies: cookies,
      headers: reqObj.request.headers,
      queryString: [],
      postData: {},
      headersSize: -1,
      bodySize: -1,
      timestamp: startTs
    }

    if (request.method !== 'GET') {
      const f = 1
    }

    this._requestsMap.set(reqObj.requestId, request)
  }

  /**
   * @public
   * @method addResponse
   *
  */
  addResponse (respObj, cookies) {
    const startTs = new Date() // respObj.response.request.startTime
    const regExVer = /HTTP\/\d+\.\d+/
    const request = this._requestsMap.get(respObj.requestId)
    this._requestsMap.delete(respObj.requestId) // clean up

    const response = {
      status: respObj.response.status,
      statusText: respObj.response.statusText,
      cookies: cookies,
      headers: respObj.response.headers,
      content: {
        size: respObj.bodyObj.body.length,
        mimeType: respObj.response.headers['Content-Type'],
        text: respObj.bodyObj.body,
        encoding: respObj.bodyObj.base64Encoding ? 'base64' : 'ascii'
      },
      redirectURL: '',
      headersSize: respObj.response.headersText === undefined ? -1
                    : respObj.response.headersText.length,
      bodySize: respObj.bodyObj.body.length
    }

    let httpVerArr = regExVer.exec(respObj.response.headersText)
    response.httpVersion = (httpVerArr === null)
                    ? respObj.response.protocol.toUpperCase() : httpVerArr[0]

    httpVerArr = regExVer.exec(respObj.response.requestHeadersText)
    // ugg, just use the response headers if null
    request.httpVersion = (httpVerArr === null)
              ? response.httpVersion : httpVerArr[0]

    const timings = {
      send: 0,
      wait: 0,
      receive: 0
    }

    const harRequest = {
      startedDateTime: new Date(startTs).toISOString(),
      time: 0,
      request: request,
      response: response,
      cache: {},
      timings: timings
    }

    this._entries.push(harRequest)
  }
}

/********************************************************/

/**
 * @private
 * @method pushToStream
*/
internals.x = function () {
}

module.exports = HarBuilder
