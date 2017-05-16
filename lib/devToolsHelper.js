'use strict'

const { EventEmitter } = require('events')

/**
 */
class DevToolsHelper extends EventEmitter {
  /**
   * @protected
   * emitAsync
  */
  emitAsync (eventMsg, err, data) {
    setImmediate(function emitAsync (iEventMsg, iErr, iData) {
      this.emit(iEventMsg, iErr, iData)
    }.bind(this), eventMsg, err, data)
  }
}

module.exports = DevToolsHelper
