'use strict'

const RemoteDebugChrome = require('../lib/remoteDebugChrome.js')

const DEBUG = false

const main = async function () {
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

  const remoteDebugChrome = new RemoteDebugChrome()
  const connectVal = await remoteDebugChrome.connect(remoterOptions)

  remoteDebugChrome.on('HarEntry', function onHarEntry (err, harEntry) {
    if (err !== null && err !== undefined ) console.log(`remoteDebugChrome: ${err.stack}`)
    else console.log(harEntry.request.url)
  })

  remoteDebugChrome.on('event', function (message) {
    if (DEBUG) console.log(`chrome-remote-interface: ${message.method}`)
  })

  remoteDebugChrome.on('disconnect', function () {
    console.log(`chrome-remote-interface disconnected`)
  })

  remoteDebugChrome.on('ready', function () {
    if (DEBUG) console.log(`chrome-remote-interface ready`)
  })

  remoteDebugChrome.on('connect', function () {
    console.log(`chrome-remote-interface connect`)
  })

  remoteDebugChrome.on('error', function (error) {
    console.log(`chrome-remote-interface error: ${error.stack}`)
  })
}

main()