import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())


export const scrapeIndeedJobs = async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  )

  await page.goto('https://www.indeed.com/jobs?q=web+developer&l=remote', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  })

  await page.waitForSelector('.job_seen_beacon', { timeout: 15000 })

  const jobs = await page.evaluate(() => {
    const jobCards = document.querySelectorAll('.job_seen_beacon')
    const scrapedJobs = []

    jobCards.forEach(card => {
      const title = card.querySelector('h2 span')?.innerText || ''
      const company = card.querySelector('.companyName')?.innerText || ''
      const location = card.querySelector('.companyLocation')?.innerText || ''
      const relativeLink = card.querySelector('a')?.getAttribute('href') || ''
      const url = relativeLink ? 'https://www.indeed.com' + relativeLink : ''

      if (title && company && location && url) {
        scrapedJobs.push({ title, company, location, url })
      }
    })

    return scrapedJobs
  })

  await browser.close()
  return jobs
}
