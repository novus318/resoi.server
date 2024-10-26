import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import path from "path";
import morgan from "morgan";
import http from 'http';
import connectDB from "./config/db.js";
import authRoutes from './routes/authRoute.js';
import itemRoutes from './routes/itemRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import tableRoutes from './routes/tableRoute.js';
import userRoutes from './routes/userRoute.js';
import onlineRoutes from './routes/onlineRoutes.js';
import tableOrderRoutes from './routes/tableOrderRoutes.js';
import { setupWebSocket } from './utils/webSocketUtils.js'; // Import the setup function

dotenv.config({ path: './.env' });

const app = express();
const server = http.createServer(app); // Create HTTP server
setupWebSocket(server); // Setup WebSocket with the server

// Middleware
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(morgan('dev'));

// Database connection
connectDB();

// Home route
app.get('/', async (req, res) => {
    res.send('App started running. You can fetch API results.');
});

// Serve static files for item images
app.use('/itemImages', express.static(path.join(new URL(import.meta.url).pathname, '..', 'itemImages')));

// Define API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/item', itemRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/table', tableRoutes);
app.use('/api/online', onlineRoutes);
app.use('/api/tableOrder', tableOrderRoutes);

// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
