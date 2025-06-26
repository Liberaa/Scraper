// @ts-nocheck
/**
 * Indeed-scraper v34.0.0 — "Enhanced Anti-Detection" edition


/*****************************************************************
 * DEPENDENCIES                                                  *
 *****************************************************************/
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import axios from 'axios';
import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import cloudscraper from 'cloudscraper';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configure stealth plugin with more options
puppeteer.use(StealthPlugin({
  enabledEvasions: new Set([
    'chrome.app',
    'chrome.csi',
    'chrome.loadTimes',
    'chrome.runtime',
    'defaultArgs',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'sourceurl',
    'user-agent-override',
    'webgl.vendor',
    'window.outerdimensions'
  ])
}));

/*****************************************************************
 * ENHANCED CONSTANTS & CONFIGURATION                           *
 *****************************************************************/
const PAGE_SIZE = 10;
const BASE_PAUSE_MS = 3000; // Increased base pause
const MAX_PAUSE_MS = 8000;
const DEFAULT_Q = 'fullstack utvecklare';
const ANT_KEY = process.env.SCRAPINGANT_KEY || 'demo';
const PROXY_LIST = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];

// Enhanced User Agent rotation with realistic distribution
const UA_POOL = [
  // Chrome (most common)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  // Firefox
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0',
  // Safari
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  // Edge
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0'
];

// Enhanced selectors with fallbacks and dynamic detection
const SELECTOR_GROUPS = {
  primary: [
    'li[data-testid="jobCard"]',
    'div[data-testid="jobCard"]',
    'a.jcs-JobTitle',
    'div.job_seen_beacon'
  ],
  legacy: [
    'a.tapItem',
    'a.slider_item',
    'a.cardOutline',
    '[data-tn-component="organicJob"]',
    'div.jobsearch-SerpJobCard',
    '.result'
  ],
  title: [
    '[data-testid="jobTitle"]',
    '[aria-label*="job"]',
    'h2 a[data-jk]',
    'span[title]',
    '.jobTitle'
  ],
  company: [
    '[data-testid="company-name"]',
    '.companyName',
    '.company',
    'span.companyName'
  ],
  location: [
    '[data-testid="text-location"]',
    '.companyLocation',
    '.location',
    'div[data-testid="job-location"]'
  ]
};

// Cookie consent selectors
const COOKIE_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '.onetrust-close-btn-handler',
  '[data-testid="cookie-accept"]',
  '.cookie-accept',
  '#accept-cookies'
];

// Cloudflare detection patterns
const CLOUDFLARE_PATTERNS = [
  /Just a moment/i,
  /Checking your browser/i,
  /Please wait while we check your browser/i,
  /This process is automatic/i,
  /Security check/i,
  /Attention Required/i,
  /Access denied/i,
  /Ray ID:/i,
  /cloudflare/i
];

/*****************************************************************
 * UTILITY FUNCTIONS                                            *
 *****************************************************************/
const xml = new XMLParser({ ignoreAttributes: false });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const dbg = (...m) => console.log(new Date().toISOString(), '[Indeed]', ...m);

const randomUA = () => UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
const randomProxy = () => PROXY_LIST.length ? PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)] : null;
const randomPause = () => BASE_PAUSE_MS + Math.floor(Math.random() * (MAX_PAUSE_MS - BASE_PAUSE_MS));
const randomFloat = (min, max) => Math.random() * (max - min) + min;

const qEnc = (s) => s.trim().split(/\s+/).join('+');
const deskUrl = (q, p, l) => `https://se.indeed.com/jobs?q=${qEnc(q)}${l ? `&l=${encodeURIComponent(l)}` : ''}&sort=date&start=${p * PAGE_SIZE}`;
const rssUrl = (q, l) => `https://se.indeed.com/jobs?q=${qEnc(q)}${l ? `&l=${encodeURIComponent(l)}` : ''}&sort=date&rss=1`;

const norm = (t) => t.replace(/\s+/g, ' ').trim();
const job = (o) => ({ title: '', company: '', location: '', posted: '', summary: '', link: '', source: '', ...o });

// Enhanced headers with more realistic values
const getHeaders = (ua = null) => ({
  'User-Agent': ua || randomUA(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'DNT': '1'
});

// Detect if content is Cloudflare challenge
const isCloudflareChallenge = (html, title = '') => {
  const titleCheck = CLOUDFLARE_PATTERNS.some(pattern => pattern.test(title));
  const contentCheck = CLOUDFLARE_PATTERNS.some(pattern => pattern.test(html));
  return titleCheck || contentCheck;
};

// Enhanced session management
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.failedAttempts = new Map();
    this.lastRequest = new Map();
  }

  getSession(key) {
    return this.sessions.get(key);
  }

  setSession(key, data) {
    this.sessions.set(key, { ...data, timestamp: Date.now() });
  }

  recordFailure(key) {
    const count = this.failedAttempts.get(key) || 0;
    this.failedAttempts.set(key, count + 1);
  }

  getFailureCount(key) {
    return this.failedAttempts.get(key) || 0;
  }

  shouldSkip(key, threshold = 3) {
    return this.getFailureCount(key) >= threshold;
  }

  async respectRateLimit(key, minInterval = 2000) {
    const lastTime = this.lastRequest.get(key) || 0;
    const elapsed = Date.now() - lastTime;
    if (elapsed < minInterval) {
      await sleep(minInterval - elapsed);
    }
    this.lastRequest.set(key, Date.now());
  }
}

const sessionManager = new SessionManager();

/*****************************************************************
 * 1️⃣ ENHANCED RSS FETCHER                                      *
 *****************************************************************/
async function rssFetch(q, l) {
  const url = rssUrl(q, l);
  const sessionKey = `rss_${q}_${l}`;
  
  if (sessionManager.shouldSkip(sessionKey)) {
    dbg('RSS - skipping due to previous failures');
    return [];
  }

  try {
    await sessionManager.respectRateLimit(sessionKey);
    dbg('RSS →', url);
    
    const headers = getHeaders();
    const { data, status } = await axios.get(url, {
      headers,
      timeout: 20000,
      responseType: 'text',
      validateStatus: s => s < 500,
      maxRedirects: 3
    });

    if (status >= 400 || typeof data !== 'string' || !data.trim().startsWith('<?xml')) {
      dbg('RSS invalid response', status);
      sessionManager.recordFailure(sessionKey);
      return [];
    }

    const parsed = xml.parse(data);
    const items = parsed?.rss?.channel?.item ?? [];
    
    if (!Array.isArray(items)) {
      dbg('RSS no items found');
      return [];
    }

    const res = items.map(it => job({
      title: it.title ?? '',
      company: (it.author ?? '').replace(/^Company: */i, ''),
      location: (it.location ?? l) || '',
      posted: it.pubDate ?? '',
      summary: norm((it.description ?? '').replace(/<[^>]+>/g, '')),
      link: it.link ?? '',
      source: 'indeed-rss-enhanced'
    }));

    dbg('RSS OK', res.length);
    return res;
  } catch (e) {
    dbg('RSS error', e.message);
    sessionManager.recordFailure(sessionKey);
    return [];
  }
}

/*****************************************************************
 * 2️⃣ ENHANCED SCRAPINGANT FETCHER                              *
 *****************************************************************/
async function antFetch(q, p, l) {
  if (ANT_KEY === 'demo') {
    dbg('ScrapingAnt - skipping (no API key)');
    return [];
  }

  const sessionKey = `ant_${q}_${p}_${l}`;
  if (sessionManager.shouldSkip(sessionKey)) {
    dbg('ScrapingAnt - skipping due to previous failures');
    return [];
  }

  const target = deskUrl(q, p, l);
  const antUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(target)}&x-api-key=${ANT_KEY}&browser=true&return_page_source=true`;

  try {
    await sessionManager.respectRateLimit(sessionKey, 5000);
    dbg('ScrapingAnt →', target);

    const { data, status } = await axios.get(antUrl, {
      headers: { 'x-api-key': ANT_KEY },
      timeout: 60000,
      responseType: 'text'
    });

    if (status !== 200 || typeof data !== 'string') {
      dbg('ScrapingAnt invalid response', status);
      sessionManager.recordFailure(sessionKey);
      return [];
    }

    if (isCloudflareChallenge(data)) {
      dbg('ScrapingAnt - Cloudflare challenge detected');
      sessionManager.recordFailure(sessionKey);
      return [];
    }

    const $ = load(data);
    const res = parseHtml($, 'indeed-ant-enhanced');
    dbg('ScrapingAnt OK', res.length);
    return res;
  } catch (e) {
    dbg('ScrapingAnt error', e.message);
    sessionManager.recordFailure(sessionKey);
    return [];
  }
}

/*****************************************************************
 * 3️⃣ ENHANCED CLOUDSCRAPER FETCHER                             *
 *****************************************************************/
async function cloudFetch(q, p, l) {
  const url = deskUrl(q, p, l);
  const sessionKey = `cloud_${q}_${p}_${l}`;
  
  if (sessionManager.shouldSkip(sessionKey)) {
    dbg('CloudScraper - skipping due to previous failures');
    return [];
  }

  try {
    await sessionManager.respectRateLimit(sessionKey, 4000);
    dbg('CloudScraper →', url);

    const proxy = randomProxy();
    const headers = getHeaders();
    
    const html = await cloudscraper.get({
      uri: url,
      headers,
      gzip: true,
      timeout: 50000,
      proxy: proxy || undefined,
      resolveWithFullResponse: false,
      followAllRedirects: true
    });

    if (isCloudflareChallenge(html)) {
      dbg('CloudScraper - Cloudflare challenge detected');
      try {
        const filename = path.resolve(`challenge_${Date.now()}.html`);
        fs.writeFileSync(filename, html);
        dbg('Challenge HTML saved:', filename);
      } catch (e) {
        dbg('Failed to save challenge HTML:', e.message);
      }
      sessionManager.recordFailure(sessionKey);
      return [];
    }

    const $ = load(html);
    const res = parseHtml($, 'indeed-cloud-enhanced');
    dbg('CloudScraper OK', res.length);
    return res;
  } catch (e) {
    dbg('CloudScraper error', e.message);
    sessionManager.recordFailure(sessionKey);
    return [];
  }
}

/*****************************************************************
 * 4️⃣ ENHANCED PUPPETEER FETCHER                                *
 *****************************************************************/
async function puppeteerFetch(q, p, l) {
  const sessionKey = `puppeteer_${q}_${p}_${l}`;
  
  if (sessionManager.shouldSkip(sessionKey)) {
    dbg('Puppeteer - skipping due to previous failures');
    return [];
  }

  let browser;
  try {
    await sessionManager.respectRateLimit(sessionKey, 6000);
    
    const proxy = randomProxy();
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ];
    
    if (proxy) args.push(`--proxy-server=${proxy}`);

    browser = await puppeteer.launch({
      headless: 'new',
      args,
      timeout: 90000,
      ignoreDefaultArgs: ['--enable-automation'],
      defaultViewport: {
        width: 1366 + Math.floor(Math.random() * 200),
        height: 768 + Math.floor(Math.random() * 200)
      }
    });

    const page = await browser.newPage();
    const ua = randomUA();
    await page.setUserAgent(ua);
    
    // Enhanced headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    });

    // Request interception with realistic filtering
    await page.setRequestInterception(true);
    page.on('request', req => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const url = deskUrl(q, p, l);
    dbg('Puppeteer →', url);
    
    // Navigate with realistic timing
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 120000 
    });

    // Random initial delay
    await sleep(randomFloat(1000, 3000));

    dbg('Puppeteer landed on:', await page.url());
    const title = await page.title();
    dbg('Puppeteer page title:', title);

    /*****************************************************************
     * 🔐 ENHANCED CLOUDFLARE HANDLING                               *
     *****************************************************************/
    let cloudflareRetries = 0;
    const maxCloudflareRetries = 3;
    
    while (cloudflareRetries < maxCloudflareRetries) {
      const currentTitle = await page.title();
      const currentUrl = await page.url();
      const bodyText = await page.evaluate(() => document.body.innerText);
      
      if (isCloudflareChallenge(bodyText, currentTitle)) {
        dbg(`Cloudflare challenge detected (attempt ${cloudflareRetries + 1})`);
        
        // Human-like mouse movement and click
        const viewport = page.viewport();
        const x = viewport.width / 2 + randomFloat(-50, 50);
        const y = viewport.height / 2 + randomFloat(-50, 50);
        
        await page.mouse.move(x, y, { steps: randomFloat(5, 15) });
        await sleep(randomFloat(500, 1500));
        await page.mouse.click(x, y, { delay: randomFloat(100, 300) });
        
        // Wait for navigation or network idle
        try {
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
            page.waitForNetworkIdle({ idleTime: 2000, timeout: 30000 })
          ]);
        } catch (e) {
          dbg('Cloudflare navigation timeout:', e.message);
        }
        
        await sleep(randomFloat(2000, 4000));
        cloudflareRetries++;
        
        const newUrl = await page.url();
        dbg('After Cloudflare click - now on:', newUrl);
        
        if (newUrl !== currentUrl) {
          break; // Successfully navigated away
        }
      } else {
        break; // No Cloudflare challenge
      }
    }

    /*****************************************************************
     * 🍪 ENHANCED COOKIE CONSENT HANDLING                           *
     *****************************************************************/
    try {
      for (const selector of COOKIE_SELECTORS) {
        const cookieBtn = await page.$(selector);
        if (cookieBtn) {
          dbg('Cookie consent button found:', selector);
          await sleep(randomFloat(500, 1500));
          await cookieBtn.click({ delay: randomFloat(50, 150) });
          await sleep(randomFloat(1000, 2000));
          break;
        }
      }
    } catch (e) {
      dbg('Cookie consent error:', e.message);
    }

    // Human-like scrolling and interaction
    await page.evaluate(() => {
      window.scrollBy(0, Math.random() * 400 + 200);
    });
    await sleep(randomFloat(1000, 2000));

    // Wait for job elements with multiple selector attempts
    let jobElements = [];
    for (const selectorGroup of Object.values(SELECTOR_GROUPS)) {
      for (const selector of selectorGroup) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          jobElements = await page.$$(selector);
          if (jobElements.length > 0) {
            dbg(`Found ${jobElements.length} elements with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      if (jobElements.length > 0) break;
    }

    // Additional scrolling if few elements found
    if (jobElements.length < 3) {
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, Math.random() * 800 + 400);
        });
        await sleep(randomFloat(800, 1500));
        
        // Re-check for elements
        const allSelectors = Object.values(SELECTOR_GROUPS).flat().join(',');
        const newCount = await page.$$eval(allSelectors, els => els.length);
        if (newCount > jobElements.length) {
          jobElements = await page.$$(allSelectors);
          if (newCount >= 5) break;
        }
      }
    }

    dbg('Puppeteer - final element count:', jobElements.length);

    // Save HTML snapshot if no jobs found
    if (jobElements.length === 0) {
      try {
        const html = await page.content();
        const filename = path.join(os.tmpdir(), `indeed_empty_${Date.now()}.html`);
        fs.writeFileSync(filename, html, 'utf8');
        dbg('Empty page HTML saved:', filename);
      } catch (e) {
        dbg('Failed to save empty HTML:', e.message);
      }
    }

    // Extract job data with enhanced selectors
    const jobs = await page.evaluate((selectorGroups) => {
      const normalize = t => t.replace(/\s+/g, ' ').trim();
      
      const getAllSelectors = () => Object.values(selectorGroups).flat().join(',');
      const nodes = [...document.querySelectorAll(getAllSelectors())];
      
      const extractText = (element, selectors, attribute = null) => {
        for (const selector of selectors) {
          const el = element.querySelector(selector);
          if (el) {
            if (attribute) {
              const value = el.getAttribute(attribute);
              if (value) return normalize(value);
            } else {
              const text = el.innerText || el.textContent;
              if (text) return normalize(text);
            }
          }
        }
        return '';
      };

      return nodes.map(element => {
        // Extract title with multiple methods
        let title = extractText(element, selectorGroups.title, 'aria-label') ||
                   extractText(element, selectorGroups.title, 'title') ||
                   extractText(element, selectorGroups.title) ||
                   (element.getAttribute('aria-label') || '').trim();

        if (!title) return null;

        // Extract other fields
        const company = extractText(element, selectorGroups.company);
        const location = extractText(element, selectorGroups.location);
        
        // Extract link
        let link = element.href || '';
        if (!link) {
          const linkEl = element.querySelector('a[href]');
          link = linkEl ? linkEl.href : '';
        }
        
        // Extract summary
        const summary = normalize(
          element.querySelector('.job-snippet, .summary, [data-testid="job-snippet-text"]')?.innerText || ''
        );
        
        // Extract posted date
        const posted = normalize(
          element.querySelector('.date, .result-footer, time, [data-testid="myJobsStateDate"]')?.innerText || ''
        );

        return {
          title,
          company,
          location,
          posted,
          summary,
          link: link.startsWith('http') ? link : `https://se.indeed.com${link}`,
          source: 'indeed-stealth-enhanced'
        };
      }).filter(Boolean);
    }, SELECTOR_GROUPS);

    dbg('Puppeteer extracted', jobs.length, 'jobs');
    if (jobs.length > 0) {
      dbg('First job title:', jobs[0].title);
    }

    await browser.close();
    return jobs;

  } catch (e) {
    dbg('Puppeteer error:', e.message);
    sessionManager.recordFailure(sessionKey);
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        dbg('Browser close error:', closeError.message);
      }
    }
    return [];
  }
}

/*****************************************************************
 * ENHANCED HTML PARSER                                         *
 *****************************************************************/
function parseHtml($, src) {
  const results = [];
  const allSelectors = Object.values(SELECTOR_GROUPS).flat().join(',');
  
  $(allSelectors).each((_, element) => {
    const $el = $(element);
    
    // Extract title with multiple methods
    let title = $el.attr('aria-label') ||
                $el.find('[aria-label]').attr('aria-label') ||
                $el.find(SELECTOR_GROUPS.title.join(',')).text() ||
                $el.find(SELECTOR_GROUPS.title.join(',')).attr('title') ||
                '';
    
    title = norm(title);
    if (!title) return; // Skip if no title found

    // Extract other fields
    const company = norm($el.find(SELECTOR_GROUPS.company.join(',')).text());
    const location = norm($el.find(SELECTOR_GROUPS.location.join(',')).text());
    const posted = norm($el.find('.date, .result-footer, time, [data-testid="myJobsStateDate"]').text());
    const summary = norm($el.find('.job-snippet, .summary, [data-testid="job-snippet-text"]').text());
    
    // Extract link
    let link = $el.attr('href') || $el.find('a').attr('href') || '';
    if (link && !link.startsWith('http')) {
      link = `https://se.indeed.com${link}`;
    }

    results.push(job({
      title,
      company,
      location,
      posted,
      summary,
      link,
      source: src
    }));
  });

  return results;
}

/*****************************************************************
 * ENHANCED MAIN AGGREGATOR                                     *
 *****************************************************************/
export async function scrapeIndeedJobs(pages = 5, q = DEFAULT_Q, l = '') {
  dbg('=== Starting Enhanced Indeed Scraper ===');
  dbg('Config:', { pages, q, l, userAgents: UA_POOL.length, proxies: PROXY_LIST.length });
  
  const allJobs = [];
  const startTime = Date.now();

  // First attempt: RSS (no pagination)
  try {
    const rssJobs = await rssFetch(q, l);
    if (rssJobs.length > 0) {
      allJobs.push(...rssJobs);
      dbg(`RSS contributed ${rssJobs.length} jobs`);
    }
  } catch (e) {
    dbg('RSS fetch failed:', e.message);
  }

  // Page-by-page scraping with exponential backoff
  for (let page = 0; page < pages; page++) {
    dbg(`\n=== Processing Page ${page + 1}/${pages} ===`);
    
    let pageJobs = [];
    const pageStartTime = Date.now();

    // Try each method in sequence
    const methods = [
      { name: 'ScrapingAnt', fn: () => antFetch(q, page, l) },
      { name: 'CloudScraper', fn: () => cloudFetch(q, page, l) },
      { name: 'Puppeteer', fn: () => puppeteerFetch(q, page, l) }
    ];

    for (const method of methods) {
      if (pageJobs.length >= 5) break; // Sufficient jobs found
      
      try {
        dbg(`Trying ${method.name}...`);
        const jobs = await method.fn();
        if (jobs.length > 0) {
          pageJobs.push(...jobs);
          dbg(`${method.name} contributed ${jobs.length} jobs`);
        }
      } catch (e) {
        dbg(`${method.name} failed:`, e.message);
      }
    }

    const pageTime = Date.now() - pageStartTime;
    dbg(`Page ${page + 1} completed in ${pageTime}ms with ${pageJobs.length} jobs`);

    if (pageJobs.length === 0) {
      dbg('No jobs found on this page - stopping pagination');
      break;
    }

    allJobs.push(...pageJobs);

    // Dynamic pause between pages
    if (page < pages - 1) {
      const pauseMs = randomPause();
      dbg(`Pausing ${pauseMs}ms before next page...`);
      await sleep(pauseMs);
    }
  }

  // Remove duplicates based on title + company
  const uniqueJobs = [];
  const seen = new Set();
  
  for (const job of allJobs) {
    const key = `${job.title}_${job.company}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueJobs.push(job);
    }
  }

  const totalTime = Date.now() - startTime;
  dbg(`\n=== Scraping Complete ===`);
  dbg(`Total time: ${totalTime}ms`);
  dbg(`Total jobs found: ${allJobs.length}`);
  dbg(`Unique jobs: ${uniqueJobs.length}`);
  dbg(`Success rate: ${uniqueJobs.length > 0 ? 'SUCCESS' : 'FAILED'}`);

  return uniqueJobs;
}

/*****************************************************************
 * ENHANCED ERROR RECOVERY & RETRY LOGIC                        *
 *****************************************************************/
class RetryManager {
  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 30000,
      backoffFactor: 2
    };
  }

  async executeWithRetry(fn, context = 'operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn();
        if (attempt > 1) {
          dbg(`${context} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === this.retryConfig.maxRetries) {
          dbg(`${context} failed after ${attempt} attempts:`, error.message);
          break;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        dbg(`${context} failed on attempt ${attempt}, retrying in ${delay}ms:`, error.message);
        await sleep(delay);
      }
    }
    
    throw lastError;
  }
}

const retryManager = new RetryManager();

/*****************************************************************
 * ENHANCED MONITORING & ANALYTICS                              *
 *****************************************************************/
class ScrapingAnalytics {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cloudflareBlocks: 0,
      timeouts: 0,
      methodSuccess: {
        rss: 0,
        scrapingant: 0,
        cloudscraper: 0,
        puppeteer: 0
      },
      avgResponseTime: 0,
      totalResponseTime: 0
    };
  }

  recordRequest(method, success, responseTime, error = null) {
    this.metrics.totalRequests++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.avgResponseTime = this.metrics.totalResponseTime / this.metrics.totalRequests;

    if (success) {
      this.metrics.successfulRequests++;
      this.metrics.methodSuccess[method]++;
    } else {
      this.metrics.failedRequests++;
      
      if (error) {
        if (error.message.includes('cloudflare') || error.message.includes('challenge')) {
          this.metrics.cloudflareBlocks++;
        } else if (error.message.includes('timeout')) {
          this.metrics.timeouts++;
        }
      }
    }
  }

  getReport() {
    const successRate = (this.metrics.successfulRequests / this.metrics.totalRequests) * 100;
    
    return {
      summary: {
        totalRequests: this.metrics.totalRequests,
        successRate: `${successRate.toFixed(1)}%`,
        avgResponseTime: `${this.metrics.avgResponseTime.toFixed(0)}ms`
      },
      methods: this.metrics.methodSuccess,
      issues: {
        cloudflareBlocks: this.metrics.cloudflareBlocks,
        timeouts: this.metrics.timeouts,
        otherFailures: this.metrics.failedRequests - this.metrics.cloudflareBlocks - this.metrics.timeouts
      }
    };
  }
}

const analytics = new ScrapingAnalytics();

/*****************************************************************
 * CONFIGURATION VALIDATOR                                      *
 *****************************************************************/
function validateConfig() {
  const issues = [];
  
  if (!process.env.SCRAPINGANT_KEY && ANT_KEY === 'demo') {
    issues.push('ScrapingAnt API key not configured (set SCRAPINGANT_KEY env var)');
  }
  
  if (PROXY_LIST.length === 0) {
    issues.push('No proxies configured (set PROXY_LIST env var with comma-separated list)');
  }
  
  if (issues.length > 0) {
    dbg('Configuration warnings:');
    issues.forEach(issue => dbg(`  - ${issue}`));
  }
  
  return issues.length === 0;
}

/*****************************************************************
 * ENHANCED CLI INTERFACE                                       *
 *****************************************************************/
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === process.argv[1]) {
  (async () => {
    try {
      const [, , pagesArg, queryArg, locationArg, outputFile, ...flags] = process.argv;
      
      // Parse arguments
      const pages = parseInt(pagesArg || '1', 10);
      const query = queryArg || DEFAULT_Q;
      const location = locationArg || '';
      const verbose = flags.includes('--verbose') || flags.includes('-v');
      const analytics_enabled = flags.includes('--analytics') || flags.includes('-a');
      
      if (verbose) {
        console.log('Enhanced Indeed Scraper v34.0.0');
        console.log('Configuration:');
        console.log(`  Pages: ${pages}`);
        console.log(`  Query: "${query}"`);
        console.log(`  Location: "${location || 'Sweden'}"`);
        console.log(`  User Agents: ${UA_POOL.length}`);
        console.log(`  Proxies: ${PROXY_LIST.length}`);
        console.log(`  ScrapingAnt: ${ANT_KEY !== 'demo' ? 'Enabled' : 'Disabled'}`);
        console.log('');
      }

      // Validate configuration
      validateConfig();

      // Execute scraping
      const startTime = Date.now();
      const jobs = await scrapeIndeedJobs(pages, query, location);
      const duration = Date.now() - startTime;

      // Display results
      if (jobs.length > 0) {
        console.table(jobs.map(({ title, company, location, source }) => ({
          title: title.length > 50 ? title.substring(0, 47) + '...' : title,
          company: company.length > 25 ? company.substring(0, 22) + '...' : company,
          location,
          source
        })));
      } else {
        console.log('❌ No jobs found. This could indicate:');
        console.log('  • Indeed has strengthened anti-bot measures');
        console.log('  • Your IP has been blocked');
        console.log('  • Search query returned no results');
        console.log('  • Selectors need updating');
      }

      console.log(`\n📊 Results: ${jobs.length} unique jobs found in ${duration}ms`);
      
      if (analytics_enabled) {
        console.log('\n📈 Analytics:');
        console.log(JSON.stringify(analytics.getReport(), null, 2));
      }

      // Save results
      if (outputFile && jobs.length > 0) {
        const output = {
          metadata: {
            timestamp: new Date().toISOString(),
            query,
            location,
            pages,
            totalJobs: jobs.length,
            duration: `${duration}ms`,
            version: '34.0.0'
          },
          jobs
        };
        
        await fs.promises.writeFile(outputFile, JSON.stringify(output, null, 2), 'utf8');
        console.log(`💾 Results saved to ${outputFile}`);
      }

      // Exit with appropriate code
      process.exit(jobs.length > 0 ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Fatal error:', error.message);
      if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  })();
}
