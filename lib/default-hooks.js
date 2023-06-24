const onRequestNoOp = async (req, res) => {
  console.log("default hook of onRequestNoOp called")
  const shouldAbort = false
  if (shouldAbort) {
    res.send("handle a rejected request here")
  }
  // 返回 true，则终端处理流程
  return shouldAbort
}

const onResponse = (req, res) => {
  console.log("hooks of onResponse")  
}

module.exports = {
  http: {
    onRequestNoOp,
    onResponse,
  },
}
