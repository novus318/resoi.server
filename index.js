import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import path from "path"
import morgan from "morgan"
import connectDB from "./config/db.js"
import authRoutes from './routes/authRoute.js'
import itemRoutes from './routes/itemRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import tableRoutes from './routes/tableRoute.js'
import userRoutes from './routes/userRoute.js'
import onlineRoutes from './routes/onlineRoutes.js'
import tableOrderRoutes from './routes/tableOrderRoutes.js'
import { initWebSocket } from "./utils/webSocket.js"
import storeRoutes from './routes/storeRoute.js'
import staffRoutes from './routes/staffRoutes.js'
import expenseRoute from './routes/expenseRoute.js'
import dashboardRoute from './routes/dashboardRoute.js'
import reportRoute from './routes/reportRoute.js'
import printRoute from './routes/reportRoute.js'


const app = express();
const PORT = 8000;

app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));
dotenv.config({ path: './.env' })



app.use(express.json())
app.use(morgan('dev'))

//database configcon
connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
initWebSocket(server);
app.get('/', async (req, res) => {
    res.send('app started running you can fetch api results')
    })
//routes
app.use('/itemImages', express.static(path.join(new URL(import.meta.url).pathname, '..', 'itemImages')));
app.use('/api/auth',authRoutes)
app.use('/api/user',userRoutes)
app.use('/api/item',itemRoutes)
app.use('/api/category',categoryRoutes)
app.use('/api/table',tableRoutes)
app.use('/api/online',onlineRoutes)
app.use('/api/tableOrder',tableOrderRoutes)
app.use('/api/store',storeRoutes)
app.use('/api/staff',staffRoutes)
app.use('/api/expense',expenseRoute)
app.use('/api/dashboard',dashboardRoute)
app.use('/api/report',reportRoute)
app.use('/api/print',printRoute)
