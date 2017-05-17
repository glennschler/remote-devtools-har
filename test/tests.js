'use strict'
const assert = require('assert')

const RemoteDebugChrome = require('../lib/remoteDebugChrome.js')

/** As defined options for the chrome-remote-interface module
 * @see https://github.com/cyrus-and/chrome-remote-interface#cdpoptions-callback
 */
const remoterOptions = {
  host: 'localhost',
  port: 9222,
  secure: false,
  target: null,
  protocol: null,
  remote: false
}

let remoteDebugChrome = null
describe('remoteDebugChrome', function inittest () {
  remoteDebugChrome = new RemoteDebugChrome(remoterOptions)
  it('instantiate should not be null', function test () {
    assert(remoteDebugChrome !== null && remoteDebugChrome !== undefined)
  })

  it('should connect', function connectTest (doneTest) {
    async function asyncTest () {
      const rcVal = await remoteDebugChrome.connect(remoterOptions)
      if (rcVal === true) doneTest()
      else doneTest(new Error(`failed to connect`))
    }
    asyncTest()
  })

  it('should destroy', function destroyTest (doneTest) {
    remoteDebugChrome.destroy()
    remoteDebugChrome.once('closed', doneTest().bind(this))
  })
})
