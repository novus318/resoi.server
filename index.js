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


const app = express();
const PORT = 8000;
const allowedOrigins = [ 'http://localhost:3001', 'http://localhost:3000','https://resoi.vercel.app'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // Allow the request
    } else {
      callback(new Error('Not allowed by CORS')); // Deny the request
    }
  }
}));
dotenv.config({ path: './.env' })

// Middleware to parse JSON bodies
app.use(express.json())
app.use(morgan('dev'))

//database configcon
connectDB();

app.get('/', async (req, res) => {
    res.send('app started running you can fetch api results')
    })
//routes
app.use('/itemImages', express.static(path.join(new URL(import.meta.url).pathname, '..', 'itemImages')));
app.use('/api/auth',authRoutes)
app.use('/api/item',itemRoutes)
app.use('/api/category',categoryRoutes)
app.use('/api/table',tableRoutes)


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
