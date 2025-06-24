import axios from 'axios'
import cheerio from 'cheerio'

export const scrapeIndeedJobs = async () => {
  const url = 'https://www.indeed.com/jobs?q=web+developer&l=remote'
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  })

  const $ = cheerio.load(data)
  const jobs = []

  $('.job_seen_beacon').each((_, el) => {
    const title = $(el).find('h2 span').text().trim()
    const company = $(el).find('.companyName').text().trim()
    const location = $(el).find('.companyLocation').text().trim()
    const relativeLink = $(el).find('a').attr('href')
    const url = relativeLink ? `https://www.indeed.com${relativeLink}` : ''

    if (title && company && location && url) {
      jobs.push({ title, company, location, url })
    }
  })

  return jobs
}
