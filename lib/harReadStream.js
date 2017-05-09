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

    this._source = ''
  }

  // _read will be called when the stream wants to pull more data in
  // the advisory size argument is ignored in this case.
  _read (size) {
    // nop but nessesary
    console.log(`_read called: size = ${size}, ` + 
                  `_readableState.flowing = ${this._readableState.flowing}`)
  }

  append (inStr) {
    // Buffer.from(inStr, 'ascii');
    if (this.push(inStr) === false) {
      console.warn(`Stream should pause!`)
    }
  }
}

module.exports = HarReadStream
