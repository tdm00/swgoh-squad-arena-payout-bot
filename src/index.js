const Bot = require("./Bot");
require("./global");
new Bot(global.botToken);

// require('http').createServer().listen(3000)
const http = require("http");
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("jedi\n");
});

server.listen(port);
