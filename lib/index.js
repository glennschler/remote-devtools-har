'use strict'

const ChromeRemoter = require('chrome-remote-interface')
const DevToolsNetwork = require('./devToolsNetwork')
const remoterOptions = {}

/**
 * initialize the chrome remote interface
 * Then this modules chrome devTools Network handler
*/
ChromeRemoter(remoterOptions)
  .then(function onInit ({ Network }) {
    return new DevToolsNetwork(Network)
  })
  .then(async function onNewDevToolsNetwork (devToolsNet) {
    console.log(`Intialized devToolsNet`)
    await devToolsNet.enable()
    return devToolsNet
  })
  .then(async function receiveAll (devToolsNet) {
    await devToolsNet.receiveAll()
    console.log(`received all. Done`)
  })
  .catch(({ stack }) => {
    console.log(`${stack}`)
  })
