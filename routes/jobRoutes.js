import express from 'express'
import { getJobs, scrapeJobs } from '../controllers/jobController.js'

const router = express.Router()

router.get('/', getJobs)
router.post('/scrape', scrapeJobs)

export default router
