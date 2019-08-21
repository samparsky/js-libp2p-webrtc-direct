/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const multiaddr = require('multiaddr')

const WebRTCDirect = require('../src')

describe('valid Connection', function () {
  this.timeout(20 * 1000)
  const ma = multiaddr('/ip4/127.0.0.1/tcp/12345/http/p2p-webrtc-direct')
  let wd
  let conn

  before(async () => {
    wd = new WebRTCDirect()

    conn = await wd.dial(ma, { config: {} })
  })

  after(async () => {
    conn && await conn.close()
  })

  it('get observed addrs', () => {
    const addrs = conn.getObservedAddrs()

    expect(addrs[0].toString()).to.equal(ma.toString())
  })
})
