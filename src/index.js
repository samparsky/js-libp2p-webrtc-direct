'use strict'

const debug = require('debug')
const log = debug('libp2p:webrtcdirect:dial')
const errcode = require('err-code')

const includes = require('lodash.includes')
const wrtc = require('wrtc')
const SimplePeer = require('simple-peer')
const isNode = require('detect-node')
const http = require('http')
const { EventEmitter } = require('events')
const mafmt = require('mafmt')
const multibase = require('multibase')
const request = require('request')
const withIs = require('class-is')
const { AbortError } = require('interface-transport')

const Libp2pSocket = require('./socket')

function noop () {}

class WebRTCDirect {
  async dial (ma, options) {
    options = {
      ...options,
      initiator: true,
      trickle: false
    }

    if (isNode) {
      options.wrtc = wrtc
    }

    const cma = ma.decapsulate('/p2p-webrtc-direct')
    const cOpts = cma.toOptions()
    log('Dialing %s:%s', cOpts.host, cOpts.port)

    const rawConn = await this._connect(cOpts, options)
    return new Libp2pSocket(rawConn, ma, options)
  }

  _connect (cOpts, options) {
    return new Promise((resolve, reject) => {
      if ((options.signal || {}).aborted) {
        return reject(new AbortError())
      }

      const start = Date.now()
      const channel = new SimplePeer(options)

      const onError = (err) => {
        const msg = `Error dialing ${cOpts.host}:${cOpts.port}: ${err.message}`
        done(errcode(msg, err.code))
      }

      const onTimeout = () => {
        log('Timeout dialing %s:%s', cOpts.host, cOpts.port)
        const err = errcode(`Timeout after ${Date.now() - start}ms`, 'ETIMEDOUT')
        // Note: this will result in onError() being called
        channel.emit('error', err)
      }

      const onConnect = () => {
        log('Connected to %s:%s', cOpts.host, cOpts.port)
        done(null, channel)
      }

      const onAbort = () => {
        log('Dial to %s:%s aborted', cOpts.host, cOpts.port)
        channel.destroy()
        done(new AbortError())
      }

      const done = (err, res) => {
        channel.removeListener('error', onError)
        channel.removeListener('timeout', onTimeout)
        channel.removeListener('connect', onConnect)

        options.signal && options.signal.removeEventListener('abort', onAbort)

        err ? reject(err) : resolve(res)
      }

      channel.once('error', onError)
      channel.once('timeout', onTimeout)
      channel.once('connect', onConnect)
      channel.on('close', () => channel.destroy())
      options.signal && options.signal.addEventListener('abort', onAbort)

      channel.on('signal', (signal) => {
        const signalStr = JSON.stringify(signal)
        const url = 'http://' + cOpts.host + ':' + cOpts.port
        const path = '/?signal=' + multibase.encode('base58btc', Buffer.from(signalStr))
        const uri = url + path

        request.get(uri, (err, res) => {
          if (err) {
            return reject(err)
          }
          const incSignalBuf = multibase.decode(res.body)
          const incSignalStr = incSignalBuf.toString()
          const incSignal = JSON.parse(incSignalStr)
          channel.signal(incSignal)
        })
      })
    })
  }

  createListener (options, handler) {
    if (!isNode) {
      throw errcode(new Error(`Can't listen if run from the Browser`), 'ERR_CANNOT_LISTEN_FROM_BROWSER')
    }

    if (typeof options === 'function') {
      handler = options
      options = {}
    }

    handler = handler || noop

    const listener = new EventEmitter()
    const server = http.createServer()
    let maSelf

    server.on('request', (req, res) => {
      res.setHeader('Content-Type', 'text/plain')
      res.setHeader('Access-Control-Allow-Origin', '*')

      const path = req.url
      const incSignalStr = path.split('?signal=')[1]
      const incSignalBuf = multibase.decode(Buffer.from(incSignalStr))
      const incSignal = JSON.parse(incSignalBuf.toString())

      options = {
        ...options,
        trickle: false
      }

      if (isNode) {
        options.wrtc = wrtc
      }

      const channel = new SimplePeer(options)
      // TODO get multiaddr
      const conn = new Libp2pSocket(channel)

      channel.on('connect', () => {
        listener.emit('connection', conn)
        handler(conn)
      })

      channel.on('signal', (signal) => {
        const signalStr = JSON.stringify(signal)
        const signalEncoded = multibase.encode('base58btc', Buffer.from(signalStr))
        res.end(signalEncoded.toString())
      })

      channel.signal(incSignal)
    })

    server.on('listening', () => listener.emit('listening'))
    server.on('error', (err) => listener.emit('error', err))
    server.on('close', () => listener.emit('close'))

    listener.listen = (ma) => {
      maSelf = ma
      const lOpts = ma.decapsulate('/p2p-webrtc-direct').toOptions()

      return new Promise((resolve, reject) => {
        server.on('listening', (err) => {
          if (err) {
            return reject(err)
          }

          listener.emit('listening')
          log('Listening on %s %s', lOpts.port, lOpts.host)
          resolve()
        })

        server.listen(lOpts)
      })
    }

    listener.close = () => {
      if (!server.listening) {
        return
      }

      return new Promise((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve())
      })
    }

    listener.getAddrs = () => {
      return [maSelf]
    }

    return listener
  }

  filter (multiaddrs) {
    if (!Array.isArray(multiaddrs)) {
      multiaddrs = [multiaddrs]
    }

    return multiaddrs.filter((ma) => {
      if (includes(ma.protoNames(), 'p2p-circuit')) {
        return false
      }

      if (includes(ma.protoNames(), 'ipfs')) {
        ma = ma.decapsulate('ipfs')
      }

      return mafmt.WebRTCDirect.matches(ma)
    })
  }
}

module.exports = withIs(WebRTCDirect, { className: 'WebRTCDirect', symbolName: '@libp2p/js-libp2p-webrtc-direct/webrtcdirect' })
