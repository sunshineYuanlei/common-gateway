const restana = require('restana')

const service = restana()
service.get('/service/test', (req, res) => res.send('Hello World!'))

service.start(3000);