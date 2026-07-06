import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { SessionUpdate, ProcessStatus } from '../types';

let io: Server;

export function initWebSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`WS client connected: ${socket.id}`);

    socket.on('join', (sessionId: string) => {
      socket.join(sessionId);
      console.log(`Socket ${socket.id} joined session ${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`WS client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function sendUpdate(
  sessionId: string,
  status: ProcessStatus,
  message: string,
  images?: string[]
): void {
  if (!io) return;
  const update: SessionUpdate = { sessionId, status, message, images };
  io.to(sessionId).emit('process_update', update);
}
