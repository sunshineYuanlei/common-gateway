// 一个高性能的请求代理库，同时支持HTTP\HTTPS\HTTP2三种协议
const fastProxy = require('fast-proxy')

module.exports = ({ proxyType, opts, route }) => {
  let proxy = fastProxy({
      base: opts.targetOverride || route.target,
      http2: !!route.http2,
      ...(route.fastProxy)
    }).proxy
  return proxy
}
 