import Job from '../models/Job.js'
import { scrapeIndeedJobs } from '../scraper/indeedScraper.js'

export const getJobs = async (req, res) => {
  const jobs = await Job.find().sort({ _id: -1 })
  res.json(jobs)
}

export const scrapeJobs = async (req, res) => {
  const jobs = await scrapeIndeedJobs()
  await Job.deleteMany({})
  await Job.insertMany(jobs)
  res.json({ message: 'Scraped and saved jobs', count: jobs.length })
}
