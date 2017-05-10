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
    this._fileOut = Fs.createWriteStream('./logs/out.har')
    this._readStream = new HarReadStream()
    this._readStream.pipe(this._fileOut)

    this._readStream.on('error', function (err) {
      console.error(`Error pushing HAR data to stream: ${JSON.stringify(err)}`)
    })

    // Bind the listener so has access to the network object
    const onResponseReceived = internals.onResponseReceived.bind(this, network)

    network.enable()
      .then(console.log(`DevTools Network enabled`))
      .then(function onEnabled () {
        // start listening for devtool network responses
        network.responseReceived(onResponseReceived)
      })
      .catch((error) => {
        console.log(`${error.stack}`)
      })
  }
}

/**
 * Event handler
 * onResponseReceived
 * @function
 * @listens Network:responseReceived
 * @param {object} network - chrome:devtools:network
 * @param {object} respObj - HTTP response object
 */
internals.onResponseReceived = async function (network, respObj) {
  try {
    const bodyObj = await
    network.getResponseBody({ requestId: respObj.requestId })

    if (bodyObj.base64Encoded === true) {
      console.log(`content len = ${bodyObj.body.length}, base64encoding ignored`)
      return
    }

    console.log(`content len = ${bodyObj.body.length}, url = ${respObj.response.url}`)

    // this loop is a test
    for (let int = 1; int <= 5; int++) {
      setImmediate(function emitAsync (ibodyObj, index) {
        const pushObj = {
          COUNT: ++this._pushCount,
          str: ibodyObj.body
        }
        if (this._readStream.append(pushObj) === false) {
          console.warn(`Stream should pause! index = ${this._pushCount}`)
        }
      }.bind(this), bodyObj, int)
    }
  } catch (err) {
    console.log(`onResponseReceived error ${err}`)
  }
}

module.exports = DevToolsNetwork
