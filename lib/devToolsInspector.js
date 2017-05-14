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
  constructor (inspector) {
    this._inspector = inspector

    inspector.detached(function detached (eventObj) {
      console.log(`Inspector.detached: ${eventObj.reason}`)
    })

    inspector.targetCrashed(function targetCrashed () {
      console.log(`Inspector. targetCrashed`)
    })

    return internals.enable.call(this)
  }
}

/**
 * @private
 * @method enable
*/
internals.enable = async function () {
  try {
    // enable the DevToolsInspector
    return await this._inspector.enable()
  } catch (err) {
    throw (new Error(err.stack))
  }
}

module.exports = DevToolsInspector
