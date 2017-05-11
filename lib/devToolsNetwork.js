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
      throw (err)
    }
  }

  /**
   * @public
   * @method receiveAll
   */
  async receiveAll () {
    // Bind the message handler so it always has `this`
    const handleResponse = internals.handleResponse.bind(this)

    // loop forever (almost)
    while (true) {
      let respObj = null
      try {
        // wait for a devtool network protocol HTTP response message
        respObj = await this._network.responseReceived()
      } catch (err) {
        console.log(`responseReceived error: ${err}`)
        throw err
      }

      if (respObj === null || respObj === undefined) {
        // break out of the loop
        break
      }

      try {
        await handleResponse(respObj)
      } catch (err) {
        console.log(`Not throwing error from handle responses loop ${err.stack}`)
      }
    }
  }
}

/**
 * handleResponse - message handler
 * @function
 * @param {object} respObj - HTTP response object
 */
internals.handleResponse = async function (respObj) {
  try {
    const bodyObj = await this._network.getResponseBody({
      requestId: respObj.requestId
    })

    for (let x = 1; x < 10000; x++) {
       for (let y = 1; y < 1000; y++) {
         console.log(`x ${x}, y ${y}`)
       }
    }

    if (bodyObj.base64Encoded === true) {
      console.log(`content len = ${bodyObj.body.length}, base64encoding ignored`)
    } else {
      this._readStream.append(bodyObj.body)
      console.log(`content len = ${bodyObj.body.length}, ` +
                  `url = ${respObj.response.url}`)
    }
  } catch (err) {
    console.log(`handleResponse error: ${err}`)
    throw err
  }
}

module.exports = DevToolsNetwork
