'use strict'

/**
 * Wrap the DevTools Protocol Inspector domain.
 *
 * @see {@link https://chromedevtools.github.io/devtools-protocol/tot/Inspector/}
 * @class
 */
class DevToolsInspector {
  /**
  * @constructor
  */
  constructor (remoteDebugChrome) {
    const { Inspector } = remoteDebugChrome._chromeDevTools
    this._inspector = Inspector

    Inspector.detached(function detached (eventObj) {
      console.log(`Inspector.detached: ${eventObj.reason}`)
    })

    Inspector.targetCrashed(function targetCrashed () {
      console.log(`Inspector. targetCrashed`)
    })
  }

  /**
   * @public
   * @method enable
  */
  async enable () {
    try {
      // enable the DevToolsInspector
      await this._inspector.enable()
    } catch (err) {
      throw (new Error(err.stack))
    }
  }

  /**
   * @public
   * @method destroy - clean up
  */
  destroy () {
    this._inspector = null
  }
}

module.exports = DevToolsInspector
