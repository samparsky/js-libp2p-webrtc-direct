'use strict'

const { Adapter } = require('interface-transport')
const withIs = require('class-is')
const WebRTCDirect = require('.')

// Legacy adapter to old transport & connection interface
class WebRTCDirectAdapter extends Adapter {
  constructor () {
    super(new WebRTCDirect())
  }
}

module.exports = withIs(WebRTCDirectAdapter, {
  className: 'WebRTCDirect',
  symbolName: '@libp2p/js-libp2p-webrtc-direct/webrtcdirect'
})
