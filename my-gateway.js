// 一个简易的高性能 Node.js 框架
const restana = require("restana")

// 使用 http-cache-middleware 作为缓存中间件
const cache = require("http-cache-middleware")()

// 默认支持的方法，包括 ['get', 'delete', 'put', 'patch', 'post', 'head', 'options', 'trace']
const DEFAULT_METHODS = require("restana/libs/methods").filter(
  (method) => method !== "all"
)

// 一个简易的 HTTP 响应库
const send = require("@polka/send-type")

// 支持 HTTP 代理
const PROXY_TYPES = ["http"]

// 默认的代理 handler
// 注意: url单独提取出来了, 方便使用; 还有proxyOpts
const defaultProxyHandler = (req, res, url, proxy, proxyOpts) =>
  proxy(req, res, url, proxyOpts)

// 代理方法
const proxyFactory = require("./lib/proxy-factory")

const gateway = (opts) => {
  // 第一步，初始化选项
  // 初始化中间件和路径正则匹配范围
  opts = Object.assign(
    {
      middlewares: [cache],
      pathRegex: "/*",
      timeout: 30 * 1000,
    },
    opts
  )

  // 第二步，生成server实例，并注册中间件
  // 运行开发者传一个 server 实例, 默认则使用 restana server
  const server = opts.server || restana()

  // 注册中间件
  opts.middlewares.forEach((middleware) => {
    server.use(middleware)
  })

  // 第三步，建议接口测试 && 代理信息整合输出
  // 一个简易的接口 `/services.json, 该接口罗列出网关代理的所有请求和相应信息
  const services = opts.routes.map((route) => ({
    prefix: route.prefix,
    docs: route.docs,
  }))
  server.get("/services.json", (req, res) => {
    send(res, 200, services)
  })

  // 路由处理
  opts.routes.forEach((route) => {
    // prefixRewrite 参数兼容
    if (undefined === route.prefixRewrite) {
      route.prefixRewrite = ""
    }

    // proxyType 参数校验
    const { proxyType = "http" } = route
    if (!PROXY_TYPES.includes(proxyType)) {
      throw new Error(
        "Unsupported proxy type, expecting one of " + PROXY_TYPES.toString()
      )
    }

    // hooks兼容
    // 加载默认的 Hooks
    const { onRequestNoOp, onResponse } = require("./lib/default-hooks")[
      proxyType
    ]
    // 加载自定义的 Hooks，允许开发者拦截并响应自己的 Hooks
    route.hooks = route.hooks || {}
    route.hooks.onRequest = route.hooks.onRequest || onRequestNoOp
    route.hooks.onResponse = route.hooks.onResponse || onResponse

    // 加载中间件，允许开发者自己传入自定义中间件
    route.middlewares = route.middlewares || []
    // 支持正则形式的 route path, 注意pathRegex的层次扩展性
    route.pathRegex =
      undefined === route.pathRegex ? opts.pathRegex : String(route.pathRegex)
    // 使用 proxyFactory 创建一个 proxy 实例
    const proxy = proxyFactory({ opts, route, proxyType })
    // 允许开发者自定义proxyHandler逻辑, 并且有默认的defaultProxyHandler兜底
    // 允许开发者自定义传入一个 proxyHandler，否则使用默认的 defaultProxyHandler
    const proxyHandler = route.proxyHandler || defaultProxyHandler
    // 设置超时时间
    route.timeout = route.timeout || opts.timeout
    const methods = route.methods || DEFAULT_METHODS

    const args = [
      // path
      route.prefix + route.pathRegex,
      // route middlewares
      ...route.middlewares,
      // 相关 handler 函数
      handler(route, proxy, proxyHandler),
    ]

    // 根据methods遍历挂载route对应的server
    methods.forEach((method) => {
      method = method.toLowerCase()
      if (server[method]) {
        server[method].apply(server, args)
      }
    })
  })
  return server
}

const handler = (route, proxy, proxyHandler) => async (req, res, next) => {
  try {
    // 支持 urlRewrite 配置
    req.url = route.urlRewrite
      ? route.urlRewrite(req)
      : req.url.replace(route.prefix, "abc")
    const shouldAbortProxy = await route.hooks.onRequest(req, res) //
    // 如果 onRequest hooks 返回一个 falsy 值, 则执行 proxyHandler, 否则停止代理
    // proxyOpts设计成了如下的hooks+request+queryString, 通过proxy/代理器发挥一定的作用
    if (!shouldAbortProxy) {
      const proxyOpts = Object.assign(
        {
          request: {
            timeout: req.timeout || route.timeout,
          },
          queryString: req.query,
        },
        route.hooks
      )
      proxyHandler(req, res, req.url, proxy, proxyOpts)
      res.send(`a common responese ${JSON.stringify(req.query)}`)
    }
  } catch (err) {
    return next(err)
  }
}
module.exports = gateway
