import { WebSocket } from 'ws';

const clients = new Map<WebSocket, { projectId?: string }>();

export function addClient(ws: WebSocket, projectId?: string): void {
  clients.set(ws, { projectId });
}

export function removeClient(ws: WebSocket): void {
  clients.delete(ws);
}

export function broadcast(event: unknown, projectId: string): void {
  const message = JSON.stringify({ type: 'event', data: event });
  for (const [ws, filter] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      if (!filter.projectId || filter.projectId === projectId) {
        ws.send(message);
      }
    }
  }
}
