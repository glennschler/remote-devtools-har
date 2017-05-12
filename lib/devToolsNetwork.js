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
    this._pushCount = 0
    this._network = network
    this._harBuilder = new HarBuilder()
    this._fileOut = Fs.createWriteStream('./logs/out.har')
    this._readStream = new HarReadStream()
    this._readStream.pipe(this._fileOut)

    this._readStream.on('error', function (err) {
      console.error(`Error pushing HAR data to stream: ${JSON.stringify(err)}`)
    })
  }

  /**
   * @public
   * @method netEnable
  */
  async enable () {
    try {
      await this._network.enable()

      // Setup the EventEmitter listener to receive every Request and Response
      const listenerForResponseEvents = internals.handleResponse.bind(this)
      this._network.responseReceived(listenerForResponseEvents)

      const listenerForRequestEvents = internals.handleRequest.bind(this)
      this._network.requestWillBeSent(listenerForRequestEvents)
    } catch (err) {
      console.log(`net.enable: ${err.stack}`)
      throw (new Error(err.stack))
    }
  }
}

/**
 * handleRequest - message handler
 * @function
 * @param {object} req - HTTP response object
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
 * @param {object} respObj - HTTP response object
 */
internals.handleResponse = async function (respObj) {
  try {
    // the response does not include the response body. Retrieve it now
    const bodyObj = await this._network.getResponseBody({
      requestId: respObj.requestId
    })

    if (bodyObj.base64Encoded === true) {
      console.log(`content len = ${bodyObj.body.length}, base64encoding ignored`)
    } else {
      // the response does not include the cookies. Retrieve it now
      const cookiesObj = await this._network.getCookies([respObj.response.url])

      respObj.bodyObj = bodyObj
      this._harBuilder.addResponse(respObj, cookiesObj.cookies)

      this._readStream.append(bodyObj.body)
      console.log(`content len = ${bodyObj.body.length}, ` +
                  `url = ${respObj.response.url}`)
    }
  } catch (err) {
    console.log(`handleResponse error: ${err.stack}`)

    // Think about EMITTING this to the Owner, because
    // this is an Event Handler, so not possible to throw to the emitter
    // ....throw new Error(`respObj: ${respObj.response.url}\n\t${err.stack}`)
  }
}

module.exports = DevToolsNetwork
