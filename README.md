### remote-devtools-har

Implements the [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface) module to gather HAR log entries from a seperate Google Chrome process.

The HAR entries emitted are the request and response entries as defined in the [HTTP Archive (HAR) v1.2 entries](https://github.com/ahmadnassri/har-spec/blob/master/versions/1.2.md#entries) specification. The response objects include the response content body which sometimes is not available ([known issue](https://bugs.chromium.org/p/chromium/issues/detail?id=141129#c46)) with the 'Save as HAR with Content' from Chrome Developer Tools when the `preserve log` option is checked.

A possible implementation of this module is to listen for the HAR entries emitted, and stream them to a complete HAR file.

#### Start Google Chrome with the default remote debugger port number, plus other possible command line arguments:

```bash
--remote-debugging-port=9222 \
--user-data-dir=$TMPDIR/chrome/tmp1 \
--no-default-browser-check \
--enable-net-benchmarking \
--no-first-run --no-proxy-server
--disable-gpu
```

#### Example usage
```
'use strict'
const RemoteDebugChrome = require('remote-devtools-har')

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

// Example of option to filter out and ignore certain request/response
const options = {
  remoterOptions: remoterOptions,
  filters: {
    ignoreRespMime: [/^image\/[^/]+/, /^application\/x-font-woff/, /^text\/css/],
    ignoreRespUrl: [/\.woff2/],
    ignoreRespBodyBase64: true
  }
}

const remoteDebugChrome = new RemoteDebugChrome()
remoteDebugChrome.connect(options)

remoteDebugChrome.once('connected', function connect () {
  console.log(`connected`)
})

remoteDebugChrome.on('harEntry', function onHarEntry (err, harEntry) {
  if (err !== null && err !== undefined) console.log(`remoteDebugChrome: ${err.stack}`)
  else {
    console.log(harEntry.request.url)
  }
})
```

#### Or start the examples which use this module
```bash
npm run example
```
* Alse see implementation which streams all emitted har entries to a file - [remote-devtools-harfile](https://github.com/glennschler/remote-devtools-harfile)

#### For reference:
* [Chrome DevTools Protocol Viewer - Network Domain](https://chromedevtools.github.io/devtools-protocol/tot/Network)

  * Network domain allows tracking network activities of the page. It exposes information about http, file, data and other requests and responses, their headers, bodies, timing, etc. 
