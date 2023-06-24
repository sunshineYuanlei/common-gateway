const rateLimit = require("express-rate-limit")
const requestIp = require("request-ip")

const {
  fgMultipleHooks: { onRequestHooks, onResponseHooks },
} = require("fg-multiple-hooks")
const hook1 = async (req, res) => {
  console.log("hook1 with logic 1 called")
  // 返回 falsy 值，不会阻断请求处理流程
  return false
}
const hook2 = async (req, res) => {
  console.log("hook2 with logic 2 called")
  const shouldAbort = false
  if (shouldAbort) {
    res.send("handle a rejected request here")
  }
  // 返回 true，则终端处理流程
  return shouldAbort
}
const PORT = 8080

const gateway = require("./my-gateway")
const server = gateway({
  // 定义一个全局中间件
  middlewares: [
    // 记录访问 IP
    (req, res, next) => {
      req.ip = requestIp.getClientIp(req)
      return next()
    },
    // 使用 RateLimit 模块
    rateLimit({
      // 1 分钟窗口期
      windowMs: 1 * 60 * 1000, // 1 minutes
      // 在窗口期内，同一个 IP 只允许访问 60 次
      max: 60,
      handler: (req, res) =>
        res.send("Too many requests, please try again later.", 429),
    }),
  ],
  // downstream 服务代理
  routes: [
    {
      prefix: "/service",
      target: "http://127.0.0.1:3000",
      docs: "just a test example",
      hooks: {
        // 使用多个 Hooks 函数，处理 onRequest
        onRequest: (req, res) => onRequestHooks(req, res, hook1, hook2),
        // rewriteHeaders(handlers) {
        //   // 可以在这里设置 response header
        //   return headers
        // },
        // 可以使用多个 Hooks 函数，处理 onResponse => onResponseHooks, 此处不做演示
        onResponse: (req, res, stream) => {
          // do some logic
        },
      },
      middlewares: [],
      pathRegex: "/*",
      proxyHandler: null,
      timeout: 5000,
      prefixRewrite: "",
    },
  ],
})
server.start(PORT).then((server) => {
  console.log(`API Gateway listening on ${PORT} port!`)
})
