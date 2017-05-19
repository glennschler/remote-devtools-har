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

  const options = {
    remoterOptions: remoterOptions,
    filters: {
      ignoreRespMime: [/^image\/[^/]+/, /^application\/x-font-woff/, /^text\/css/],
      ignoreRespUrl: [/\.woff2/],
      ignoreRespBodyBase64: true
    }
  }

  const remoteDebugChrome = new RemoteDebugChrome()
  await remoteDebugChrome.connect(options)

  remoteDebugChrome.on('harEntry', function onHarEntry (err, harEntry) {
    if (err !== null && err !== undefined) console.log(`remoteDebugChrome: ${err.stack}`)
    else console.log(harEntry.request.url)
  })

  remoteDebugChrome.once('closed', function onClosed () {
    console.log(`remoteDebugChrome closed`)
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
