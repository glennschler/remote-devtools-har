'use strict'

const HarEntryBuilder = require('./harEntryBuilder')

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
  constructor (devToolsChrome) {
    this._network = devToolsChrome._chromeDevTools.Network
    this._harBuilder = new HarEntryBuilder(devToolsChrome)

    return internals.enable.call(this)
  }

  /**
   * @public
   * @method destroy - clean up
  */
  async destroy () {
    try {
      await this._network.disable()
    } catch (err) {
      // ignore on destroy
    }

    this._harBuilder.destroy()
    this._network = null
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

    // finally, enable the devToolsNetwork. WAIT FOR IT!
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
    // Get the cookies which will be sent with the request
    const cookiesObj = await this._network.getCookies([reqObj.request.url])

    this._harBuilder.addRequest(reqObj, cookiesObj.cookies)
  } catch (err) {
    console.log(`handleRequest error: ${err.stack}`)
  }
}

/**
 * handleResponse - message handler
 * @function
 * @param {object} respObj - contains the HTTP response object
 */
internals.handleResponse = async function (respObj) {
  try {
    // the response does not include the response body. Retrieve it now
    const [respBodyObj, cookiesObj] = await Promise.all([
      this._network.getResponseBody({
        requestId: respObj.requestId
      }),
      // the response does not include the cookies. Retrieve it now
      this._network.getCookies([respObj.response.url])
    ])

    this._harBuilder.addResponse(respObj, respBodyObj, cookiesObj.cookies)
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
