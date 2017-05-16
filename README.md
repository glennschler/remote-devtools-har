## remote-devtools-har

Implements the [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface) module to gather HAR log
entries from a seperate Google Chrome process.

Still a work in progress. The HAR entries emitted are the request and response entries as defined in the [HTTP Archive (HAR) v1.2 entries](https://github.com/ahmadnassri/har-spec/blob/master/versions/1.2.md#entries) specification. The complete HAR log file is not provided. Though the response objects include the response bodies.

A possible implementation of this module is to listen for the HAR entries emitted, and stream them to a complete HAR file.

### Start Google Chrome with the default remote debugger port number, with or without other possible command line arguments:

```bash
--remote-debugging-port=9222 --user-data-dir=$TMPDIR/chrome/tmp1 --no-default-browser-check --enable-net-benchmarking --no-first-run --no-proxy-server
```

### Then start the example which uses this module
```bash
npm run example
```
