'use strict'

const EventEmitter = require('events').EventEmitter

/**
 * internals
 * To wrap private methods and properties
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
    // Bind the listener so always has access to private network object
    const onResponseReceived = internals.onResponseReceived.bind(this, network)

    network.enable()
      .then(console.log(`Network enabled`))
      .then(function onEnabled() {
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
    console.log(`content len = ${bodyObj.body.length}, url = ${respObj.response.url}`)
  } catch (err) {
    console.log(`onResponseReceived error ${err}`)
  }
}

module.exports = DevToolsNetwork
