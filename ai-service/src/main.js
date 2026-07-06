const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ service: "ai-service", status: "ok" }));
});

server.listen(3000, () => console.log("AI service running on port 3000"));
