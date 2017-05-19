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
  constructor (remoteDebugChrome) {
    this._network = remoteDebugChrome._chromeDevTools.Network
    this._harBuilder = new HarEntryBuilder(remoteDebugChrome)
  }

  /**
   * @public
   * @method enable
  */
  async enable () {
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

      // finally, enable the devToolsNetwork, wait, and emit
      return await this._network.enable()
    } catch (err) {
      throw (new Error(err.stack))
    }
  }

  /**
   * @public
   * @method destroy - clean up
  */
  destroy () {
    this._harBuilder.destroy()
    this._network = null
  }

  /**
   * retrieveResponseBody - allow the caller to get the body
   * associated with the given response event
   * @function
   * @param {object} respObj - contains the HTTP response object
  */
  retrieveResponseBody (respObj) {
    const network = this._network
    const respBodyPromise = network.getResponseBody({
      requestId: respObj.requestId
    })

    return respBodyPromise
  }

  /**
   * retrieveResponseCookies - allow the caller to get cookies
   * associated with the given response event
   * @function
   * @param {object} respObj - contains the HTTP response object
  */
  retrieveResponseCookies (respObj, cb) {
    const network = this._network
    const cookiesPromise =
      network.getCookies([respObj.response.url])

    return cookiesPromise
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
internals.handleResponse = function (respObj) {
  this._harBuilder.addResponse(respObj)
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
