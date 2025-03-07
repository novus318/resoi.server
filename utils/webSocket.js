// utils/webSocket.js
import { WebSocket, WebSocketServer } from 'ws';

let wss;

export const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');

    ws.on('message', (message) => {
      console.log('Received message:', message);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });
};

export const broadcastOnlineOrderUpdate = (order) => {
  broadcastUpdate('onlineOrder', order);
};

export const broadcastTableOrderUpdate = (order) => {
  broadcastUpdate('tableOrder', order);
};

const broadcastUpdate = (type, order) => {
  if (wss && wss.clients) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({ type, order });
        client.send(message);
      }
    });
  }
};
