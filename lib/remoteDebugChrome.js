'use strict'

const ChromeRemoter = require('chrome-remote-interface')
const DevToolsNetwork = require('./devToolsNetwork')
const DevToolsInspector = require('./devToolsInspector')
const DevToolsHelper = require('./devToolsHelper')

/**
 * internals
 * To wrap private methods and properties
 *   when bound to a instantiated object of this class
 */
const internals = {
}

/**
 * Wrap the Chrome DevTools Remote Protocol.
 *
 * @see {@link https://chromedevtools.github.io/devtools-protocol/}
 * @class
 */
class RemoteDebugChrome extends DevToolsHelper {
  /**
  * @constructor
  */
  constructor () {
    super()

    this._chromeDevTools = null
    this._networkDevTools = null
    this._inspectorDevTools = null
  }

  connect (remoterOptions) {
    const self = this
    /**
     * initialize the chrome remote interface
     * Then this modules chrome devTools Domain handlers
    */
    return ChromeRemoter(remoterOptions)
      .then(function onInit (Chrome) {
        self._chromeDevTools = Chrome

        return internals.initialize.call(self)
      })
      .then(function initPassed (initVal) {
        self.emitAsync('connected') // event based notification
        return true // promise based resolution
      })
      .catch(({ stack }) => {
        self.emitAsync('error', new Error(`ChromeRemoter catch: ${stack}`))
        self._chromeDevTools = null
        return false // promise based resolution
      })
  }

  /**
   * @public
   * @method destroy - clean up
  */
  destroy () {
    const self = this
    return new Promise((resolve, reject) => {
      if (self._networkDevTools !== null) {
        self._networkDevTools.destroy()
      }

      if (self._inspectorDevTools !== null) {
        self._inspectorDevTools.destroy()
      }

      self._chromeDevTools.close(function closed () {
        self.emitAsync('closed')  // event based notification
        resolve('destroyed')  // promise based resolution
      })

      self._chromeDevTools = null
      self._networkDevTools = null
      self._inspectorDevTools = null
    })
  }
}

/**
 * @private
 * @method initialize
*/
internals.initialize = function () {
  const self = this
  this._chromeDevTools.on('disconnect', function () {
    self.emitAsync(`disconnected`)
  })

  this._chromeDevTools.on('ready', function () {
    self.emitAsync(`ready`)
  })

  this._chromeDevTools.on('connect', function () {
    self.emitAsync('connect')
  })

  this._chromeDevTools.on('error', function (err) {
    self.emitAsync('error', err)
  })

  // the catch all if DEBUG
  this._chromeDevTools.on('event', function (message) {
    self.emitAsync('event', message)
  })

  return Promise.all([
    (this._networkDevTools = new DevToolsNetwork(this))
      .enable(),
    (this._inspectorDevTools = new DevToolsInspector(this))
      .enable()
  ])
}

module.exports = RemoteDebugChrome
