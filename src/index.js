import Bot from './Bot'
import { botToken } from './secret'
new Bot(botToken)

// require('http').createServer().listen(3000)
const http = require('http');
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('jedi\n');
});

server.listen(port)
