# Indeed Scraper  — "Anti-Detection Bypass"

A stealthy and robust scraper for job listings on [Indeed](https://www.indeed.com), using a mix of RSS, ScrapingAnt API, Cloudscraper, and Puppeteer to avoid detection.

---

## Getting Started

### 1. Clone the repository
```bash

git clone <your-repo-url>
cd <your-repo-name>

2. Install dependencies
npm install

```
3. Set environment variables
You can export them directly in your terminal or use a .env file:
```bash
export SCRAPINGANT_KEY=your_scrapingant_api_key
export PROXY_LIST=http://proxy1:port,http://proxy2:port
```
START WITH NPM START!
CLI Usage
Run the scraper using Node.js:
```bash
node indeed.js [pages] [query] [location] [output.json] [--verbose] [--analytics]
```
Example:
```bash
node indeed.js 3 "data engineer" "Stockholm" output.json --verbose --analytics
```
Features
Multiple scraping strategies: RSS, ScrapingAnt, Cloudscraper, Puppeteer

Proxy rotation and user-agent spoofing

Cookie and Cloudflare challenge handling

Retry logic, logging, and analytics

File output with metadata

Requirements
Node.js 18+

Optional: ScrapingAnt API key (SCRAPINGANT_KEY)

Optional: Proxy list (PROXY_LIST)
