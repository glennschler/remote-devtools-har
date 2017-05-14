'use strict'

const ChromeRemoter = require('chrome-remote-interface')
const DevToolsNetwork = require('./devToolsNetwork')
const DevToolsInspector = require('./devToolsInspector')

/**
 * internals
 * To wrap private methods and properties
 *   when bound to a instantiated object of this class
 */
const internals = {
}

/**
 * Wrap the Chrome DevTools Protocol.
 *
 * @see {@link https://chromedevtools.github.io/devtools-protocol/}
 * @class
 */
class DevToolsChrome {
  /**
  * @constructor
  */
  constructor () {
    this._chromeDevTools = null
    this._networkDevTools = null
    this._inspectorDevTools = null
  }

  connect (remoterOptions) {
    /**
     * initialize the chrome remote interface
     * Then this modules chrome devTools Domain handlers
    */
    ChromeRemoter(remoterOptions)
      .then(function onInit (Chrome) {
        this._chromeDevTools = Chrome

        return internals.initialize.call(this)
      }.bind(this))
      .then(console.log.bind(console))
      .catch(({ stack }) => {
        console.log(`ChromeRemoter catch: ${stack}`)
      })
  }
}

/**
 * @private
 * @method initialize
*/
internals.initialize = function () {
  this._chromeDevTools.on('disconnect', function () {
    console.log(`chrome-remote-interface disconnected`)
  })

  this._chromeDevTools.on('ready', function () {
    console.log(`chrome-remote-interface ready`)
  })

  this._chromeDevTools.on('connect', function () {
    console.log(`chrome-remote-interface connect`)
  })

  this._chromeDevTools.on('error', function (err) {
    console.log(`chrome-remote-interface error: ${err}`)
  })

  // the catch all
  this._chromeDevTools.on('event', function (message) {
    console.log(`chrome-remote-interface: ${message.method}`)
  })

  return Promise.all([
    (this._networkDevTools =
      new DevToolsNetwork(this._chromeDevTools.Network)),
    (this._inspectorDevTools =
      new DevToolsInspector(this._chromeDevTools.Inspector))
  ])
}

module.exports = DevToolsChrome