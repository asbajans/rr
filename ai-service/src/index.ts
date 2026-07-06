import express from 'express';
import { createServer } from 'http';
import path from 'path';
import aiRouter from './routes/ai';
import { initWebSocket } from './services/websocket';

const app = express();
const server = createServer(app);

initWebSocket(server);

app.use(express.json());

app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/output', express.static(path.resolve('output')));

app.use('/ai', aiRouter);

app.get('/health', (_req, res) => {
  res.json({ service: 'ai-service', status: 'ok' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`AI service running on port ${PORT}`);
});
