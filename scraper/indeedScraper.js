import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

puppeteer.use(StealthPlugin())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const scrapeIndeedJobs = async () => {
  console.log('🚀 SUPER MODE: Launching anti-bot enhanced scraper...')
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 25,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ],
    userDataDir: './tmp/real-profile'
  })

  const page = await browser.newPage()

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
  )
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  })
  await page.setViewport({ width: 1280, height: 800 })

  const url = 'https://www.indeed.com/jobs?q=web+developer&l=remote'
  console.log('🌐 Navigating to:', url)

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  } catch (err) {
    console.error('❌ Navigation failed:', err.message)
    await browser.close()
    return []
  }

  await simulateHumanActivity(page)
  await handleCloudflare(page)
  await autoScroll(page)

  try {
    await page.waitForSelector('.job_seen_beacon', { timeout: 20000 })
  } catch (err) {
    console.warn('⚠️ No job cards found. Saving debug info...')
    fs.writeFileSync(path.join(__dirname, 'debug.html'), await page.content())
    await page.screenshot({ path: 'debug.png' })
    await browser.close()
    return []
  }

  const jobs = await page.evaluate(() => {
    const jobCards = document.querySelectorAll('.job_seen_beacon')
    const results = []

    jobCards.forEach(card => {
      const title = card.querySelector('h2 span')?.innerText || ''
      const company = card.querySelector('.companyName')?.innerText || ''
      const location = card.querySelector('.companyLocation')?.innerText || ''
      const urlElement = card.querySelector('a')
      const url = urlElement ? new URL(urlElement.getAttribute('href'), 'https://www.indeed.com').href : ''
      if (title && company && location) {
        results.push({ title, company, location, url })
      }
    })

    return results
  })

  console.log(`✅ SUPER MODE SUCCESS: Scraped ${jobs.length} jobs.`)
  await browser.close()
  return jobs
}

async function handleCloudflare(page) {
  console.log('🛡 Checking for Cloudflare challenge...')
  const checkboxFrame = await waitForRecaptchaFrame(page)
  if (checkboxFrame) {
    const checkbox = await checkboxFrame.$('#recaptcha-anchor')
    if (checkbox) {
      console.log('✅ Clicking verification checkbox...')
      await checkbox.click({ delay: 200 })
      await wait(8000)
    }
  }
}

async function waitForRecaptchaFrame(page) {
  for (let i = 0; i < 10; i++) {
    const frame = page.frames().find(f => f.url().includes('recaptcha'))
    if (frame) return frame
    await wait(1000)
  }
  return null
}

async function simulateHumanActivity(page) {
  console.log('🧠 Simulating human activity...')
  await page.mouse.move(200, 150)
  await wait(400)
  await page.mouse.move(300, 250)
  await wait(300)
  await page.keyboard.press('Tab')
  await wait(500)
  await page.mouse.click(300, 250)
  await wait(300)
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0
      const distance = 200
      const timer = setInterval(() => {
        window.scrollBy(0, distance)
        totalHeight += distance
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 300)
    })
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
