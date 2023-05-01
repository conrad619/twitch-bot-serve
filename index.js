const express = require('express')

require('dotenv').config()
const app = express()

const port = process.env.PORT || 8080

app.get('/', (req, res) => {
  res.send('Hello from Space!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})