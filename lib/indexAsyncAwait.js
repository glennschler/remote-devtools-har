'use strict'

const ChromeRemoter = require('chrome-remote-interface')
const DevToolsNetwork = require('./devToolsNetwork')

/**
 * initialize the chrome remote interface
 * Then this modules chrome devTools Network handler
*/

const start = async function () {
  const init = async function chromeInit () {
    try {
      const remoterOptions = {}
      return await ChromeRemoter(remoterOptions)
    } catch (err) {
      console.log(`init: ${err}`)
      return err
    }
  }

  const rcInit = await init()
  if (rcInit.constructor === Error) return
  const network = rcInit.Network

  const devToolsNet = new DevToolsNetwork(network)
  if (devToolsNet === null) return

  const enable = async function netEnable (devToolsNet) {
    try {
      return await devToolsNet.enable()
    } catch (err) {
      console.log(`enable: ${err}`)
      return err
    }
  }

  const rcEnable = await enable(devToolsNet)
  if (rcEnable.constructor === Error) return

  const receiveAll = async function netReceiveAll (devToolsNet) {
    try {
      // loop for all messages from the network debug protocol
      return await devToolsNet.receiveAll()
    } catch (err) {
      console.log(`enable: ${err}`)
      return err
    }
  }

  const rcReceiveAll = receiveAll(devToolsNet)
  if (rcReceiveAll.constructor === Error) {
    console.log(`rcReceiveAll: ${rcReceiveAll}`)
  } else {
    console.log(`done`)
  }
}

// start it up
start()
