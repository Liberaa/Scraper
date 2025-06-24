import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import mongoose from 'mongoose'
import jobRoutes from './routes/jobRoutes.js'
import { connectDB } from './config/db.js'

dotenv.config()
connectDB()

const app = express()
const __dirname = path.resolve()

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/jobs', jobRoutes)

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'))
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
