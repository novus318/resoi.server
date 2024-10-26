import WebSocket, { WebSocketServer } from 'ws';

let clients = new Set();

export const setupWebSocket = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        clients.add(ws);
        console.log('New WebSocket client connected');

        ws.on('close', () => {
            clients.delete(ws);
            console.log('WebSocket client disconnected');
        });
    });
};

// Broadcast function for sending real-time updates to all clients
export const broadcastUpdate = (data) => {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

// Export clients for potential use elsewhere if needed
export const getClients = () => clients;
