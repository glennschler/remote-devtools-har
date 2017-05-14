'use strict'

var HarReadStream = require('./harReadStream')
var HarBuilder = require('./harBuilder')
var Fs = require('fs')

/**
 * internals
 * To wrap private methods and properties
 *   when bound to a instantiated object of this class
 */
const internals = {
}

/**
 * Wrap the DevTools Protocol Network domain.
 * Allows tracking network activities of the page. It exposes information
 * about http, file, data and other requests and responses, their headers,
 * bodies, timing, etc.
 *
 * @see {@link https://chromedevtools.github.io/devtools-protocol/tot/Network/}
 * @class
 */
class DevToolsNetwork {
  /**
  * @constructor
  */
  constructor (network) {
    this._testCount1 = 0
    this._pushCount = 0
    this._network = network
    this._harBuilder = new HarBuilder()
    this._fileOut = Fs.createWriteStream('./logs/out.har')
    this._readStream = new HarReadStream()
    this._readStream.pipe(this._fileOut)

    this._readStream.on('error', function (err) {
      console.error(`Error pushing HAR data to stream: ${JSON.stringify(err)}`)
    })

    return internals.enable.call(this)
  }
}

/**
 * @private
 * @method enable
*/
internals.enable = async function () {
  try {
    // Setup the EventEmitter listener to receive every Response event
    const listenerForResponseEvents = internals.handleResponse.bind(this)
    this._network.responseReceived(listenerForResponseEvents)

    // Setup the EventEmitter listener to receive every Request event
    const listenerForRequestEvents = internals.handleRequest.bind(this)
    this._network.requestWillBeSent(listenerForRequestEvents)

    // Setup the EventEmitter listener to receive every loadingFailed event
    const listenerLoadFailedEvents = internals.handleLoadingFailed.bind(this)
    this._network.loadingFailed(listenerLoadFailedEvents)

    // finally, enable the devToolsNetwork
    return await this._network.enable()
  } catch (err) {
    throw (new Error(err.stack))
  }
}

/**
 * handleRequest - message handler
 * @function
 * @param {object} reqObj - contains the HTTP request object
 */
internals.handleRequest = async function (reqObj) {
  try {
    // the request does not include the cookies. Retrieve it now
    const cookiesObj = await this._network.getCookies([reqObj.request.url])

    this._harBuilder.addRequest(reqObj, cookiesObj.cookies)
  } catch (err) {
    console.log(`handleRequest error: ${err.stack}`)

    // Think about EMITTING this to the Owner, because
    // this is an Event Handler, so not possible to throw to the emitter
    // ....throw new Error(err.stack)
  }
}

/**
 * handleResponse - message handler
 * @function
 * @param {object} respObj - contains the HTTP response object
 */
internals.handleResponse = async function (respObj) {
  console.log(`handleResponse ${++this._testCount1}`)
  try {
    // the response does not include the response body. Retrieve it now
    const [respBodyObj, cookiesObj] = await Promise.all([
      this._network.getResponseBody({
        requestId: respObj.requestId
      }),
      // the response does not include the cookies. Retrieve it now
      this._network.getCookies([respObj.response.url])
    ])

    const count = this._harBuilder.addResponse(respObj, respBodyObj,
                                        cookiesObj.cookies)
    if (count > 0) {
      const harEntryStr = await this._harBuilder.finishRequest({
        requestId: respObj.requestId
      })

      this._readStream.append(harEntryStr) // stream it

      console.log(`Item # ${++this._pushCount}, content len = ${respBodyObj.body.length}, ` +
                  `url = ${respObj.response.url}`)
    }
  } catch (err) {
    console.log(`handleResponse error: ${err.stack}`)

    // Think about EMITTING this to the Owner, because
    // this is an Event Handler, so not possible to throw to the emitter
    // ....throw new Error(`respObj: ${respObj.response.url}\n\t${err.stack}`)
  }
}

/**
 * handleLoadingFailed - message handler
 * @function
 * @param {object} loadObj - response object
 */
internals.handleLoadingFailed = function (loadObj) {
  try {
    this._harBuilder.addResponse(loadObj)
  } catch (err) {
    console.log(`handleLoadingFailed error: ${err.stack}`)
  }
}

module.exports = DevToolsNetwork
