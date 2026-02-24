import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';
import { initializeDatabase } from './db/schema.js';
import { addClient, removeClient } from './ws.js';
import { projectsRouter } from './routes/projects.js';
import { eventsRouter } from './routes/events.js';
import { queryRouter } from './routes/query.js';

const PORT = 3800;

const app = express();
app.use(cors());
app.use(express.json());

// Initialize DB
initializeDatabase();
console.log('[Baden] Database initialized');

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/query', queryRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const projectId = url.searchParams.get('projectId') || undefined;
  addClient(ws, projectId);

  console.log(`[WS] Client connected (projectId: ${projectId || 'all'})`);

  ws.on('close', () => {
    removeClient(ws);
    console.log('[WS] Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`[Baden] Server running on http://localhost:${PORT}`);
  console.log(`[Baden] WebSocket on ws://localhost:${PORT}/ws`);
});
