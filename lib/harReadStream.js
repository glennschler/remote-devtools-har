'use strict'

const Readable = require('stream').Readable

/**
 * internals
 * To wrap private methods and properties
 *   when bound to a instantiated object of this class
 */
const internals = {
}

/**
* @class HarReadStream
*/
class HarReadStream extends Readable {
  /**
  * @constructor
  */
  constructor (options) {
    super(options)

    this._waitForRead = true // flag of backpressure from the stream
    this._reservoir = [] // for holding when backpressure applies
  }

  /**
   * @protected
   * @method _read()
   * will be called by super() when the stream is ready for more data
  */
  _read (size) {
    this._waitForRead = false // clear the wait state out

    /**
     * @private
     * @method pushAsync
    */
    const pushAsync = function () {
      // push to the stream at next tick
      setImmediate(function dequeueAndPush () {
        if (this._waitForRead === true) return // wait for another _read())
        if (this._reservoir.length === 0) {
          // since recursive call conflicted with another unsolicited _read()
          return
        }

        // TODO break-up this dequeued item into smaller `_read(size)` chunks
        const pushObj = this._reservoir.shift()

        // Else it is ok to push it to the stream
        internals.pushToStream.call(this, pushObj)

        pushAsync() // Recursivly (well it is async) do another
      }.bind(this))
    }.bind(this)

    // The stream is now ready for more data. Give it what may have been queued
    // It is aysnc so as to RETURN to the _read() caller immediately
    pushAsync()
  }

  /**
   * @public
   * @method append
   * push to the stream
  */
  append (pushObj) {
    // If the stream has already signaled backpressure, or if
    // items already queued in reservoir, add this item to end of reservoir
    if (this._waitForRead === true || this._reservoir.length > 0) {
      console.warn(`Queueing inStr. Stream is paused`)

      // queue it until the stream asks for more via _read()
      this._reservoir.push(pushObj)
      return false
    } else {
      // Else it is ok to push directly to the stream
      return internals.pushToStream.call(this, pushObj)
    }
  }
}

/********************************************************/

/**
 * @private
 * @method pushToStream
*/
internals.pushToStream = function (pushObj) {
  const pushStr = pushObj.constructor === String ? pushObj : pushObj.toString()

  // Do not convert string to a buffer. The push() will do it
  const rcBool = this.push(pushStr)
  if (rcBool === false) {
    this._waitForRead = true // backpressure === true
    console.warn(`Backpressure alert!. Stream paused`)
  }

  return rcBool // the result from the stream.push()
}

module.exports = HarReadStream
