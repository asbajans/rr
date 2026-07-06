const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "integration-service", status: "ok" }));
});

server.listen(3001, () => console.log("Integration service running on port 3001"));
