'use strict'

const Readable = require('stream').Readable

// source is an object with readStop() and readStart() methods,
// and an `ondata` member that gets called when it has data, and
// an `onend` member that gets called when the data is over.

/**
* @class
*/
class HarReadStream extends Readable {
  /**
  * @constructor
  */
  constructor (options) {
    super(options)

    this._waitForRead = true
    this._reservoir = [] // for holding when backpressure applies
  }

  /**
   * @protected
   * @method _read()
   * will be called when the stream is ready for more data
   */
  _read (size) {
    this._waitForRead = false // clear the wait state out

    const shiftAppend = function () {
      if (this._reservoir.length === 0) return // nothing to pop
      if (this._waitForRead === true) return // wait for another _read() call

      // TODO break this dequeued item into smaller `_read(size)` chunks
      const itemStr =  this._reservoir.shift()
      this.append(itemStr)

      // attempt to append to the stream at next tick
      setImmediate(function dequeue() {
        shiftAppend() // do another
      }.bind(this))
    }.bind(this)

    // The stream is now ready for more data. Give it any which has been queued
    shiftAppend()
  }

  /**
   * @public
   * @method append()
   * push to the stream
  */
  append (pushObj) {    
    if (this._waitForRead === true) {
      console.warn(`Queueing inStr. Stream is paused`)

      // queue it until the stream asks for more via _read()
      this._reservoir.push(pushObj)
      return false
    }

    console.log(`pushing ITEM # ${pushObj.COUNT}`)
    const pushStr = `\nCOUNT = ${pushObj.COUNT}:\n${pushObj.str}`

    // Do not convert string to a buffer. The push() will do it
    if (this.push(pushStr) === false) {
      this._waitForRead = true // signal to wait on future appends
      console.warn(`Backpressure alert!. Stream paused`)

      return false
    }    
  }
}

module.exports = HarReadStream
