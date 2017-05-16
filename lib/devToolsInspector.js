'use strict'

/**
 * internals
 * To wrap private methods and properties
 *   when bound to a instantiated object of this class
 */
const internals = {
}

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
  constructor (devToolsChrome) {
    const { Inspector } = devToolsChrome._chromeDevTools
    this._inspector = Inspector

    Inspector.detached(function detached (eventObj) {
      console.log(`Inspector.detached: ${eventObj.reason}`)
    })

    Inspector.targetCrashed(function targetCrashed () {
      console.log(`Inspector. targetCrashed`)
    })

    return internals.enable.call(this)
  }

  /**
   * @public
   * @method destroy - clean up
  */
  async destroy () {
    try {
      await this._inspector.disable()
    } catch (err) {
      // ignore on destroy
    }

    this._inspector = null
  }
}

/**
 * @private
 * @method enable
*/
internals.enable = async function () {
  try {
    // enable the DevToolsInspector. Wait for it!
    return await this._inspector.enable()
  } catch (err) {
    throw (new Error(err.stack))
  }
}

module.exports = DevToolsInspector
