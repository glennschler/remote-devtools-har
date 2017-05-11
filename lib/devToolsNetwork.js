'use strict'

var HarReadStream = require('./harReadStream')
var Fs = require('fs')

/**
 * internals
 * To wrap private methods and properties
 *   when given the instantiated context (bind, call, apply)
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
      return await this._network.enable()
    } catch (err) {
      console.log(`net.enable: ${err.stack}`)
      return err
    }
  }

  /**
   * @public
   * @method receiveAll
   */
  async receiveAll () {
    // Bind the message handler so it always has `this`
    const responseReceived = internals.onResponseReceived.bind(this)

    // loop forever (almost)
    while (true) {
      let respObj = null
      try {
        // wait for a devtool network protocol HTTP response message
        respObj = await this._network.responseReceived()
      } catch (err) {
        console.log(`responseReceived error: ${err}`)
      }

      if (respObj === null || respObj === undefined) {
        break
      } else {
        responseReceived(respObj)
      }
    }
  }
}

/**
 * onResponseReceived - message handler
 * @function
 * @param {object} respObj - HTTP response object
 */
internals.onResponseReceived = async function (respObj) {
  try {
    const bodyObj = await this._network.getResponseBody({
      requestId: respObj.requestId
    })

    if (bodyObj.base64Encoded === true) {
      console.log(`content len = ${bodyObj.body.length}, base64encoding ignored`)
    } else {
      this._readStream.append(bodyObj.body)
      console.log(`content len = ${bodyObj.body.length}, ` +
                  `url = ${respObj.response.url}`)
    }
  } catch (err) {
    console.log(`onResponseReceived error: ${err}`)
  }
}

module.exports = DevToolsNetwork
