'use strict'

const WebRTCDirect = require('./src')
const pull = require('pull-stream')
const pipe = require('it-pipe')
const multiaddr = require('multiaddr')

const ma = multiaddr('/ip4/127.0.0.1/tcp/12345/http/p2p-webrtc-direct')
let listener

function boot (done) {
  const wd = new WebRTCDirect()
  listener = wd.createListener((conn) => pipe(conn, conn))
  listener.on('listening', () => {
    console.log('gulp listener started on:', ma.toString())
  })
  listener.listen(ma).then(() => done()).catch(done)
  listener.on('error', console.error)
}

function shutdown (done) {
  listener.close().then(done).catch(done)
}

module.exports = {
  hooks: {
    pre: boot,
    post: shutdown
  }
}
