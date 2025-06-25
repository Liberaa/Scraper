// @ts-nocheck
/**
 * Indeed‑scraper v33.4 — "One‑Click Cloudflare"‑edition (extra‑debug)
 * -------------------------------------------------------------
 *  ▸ Fyra skrap‑nivåer (Jobs → RSS=1 → ScrapingAnt → CloudScraper → Puppeteer‑Stealth)


/*****************************************************************
 * DEPENDENCIES                                                  *
 *****************************************************************/
import fs               from 'fs';
import path             from 'path';
import os               from 'os';
import axios            from 'axios';
import { load }         from 'cheerio';
import { XMLParser }    from 'fast-xml-parser';
import cloudscraper     from 'cloudscraper';
import puppeteer        from 'puppeteer-extra';
import StealthPlugin    from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

/*****************************************************************
 * CONSTANTS & HELPERS                                           *
 *****************************************************************/
const PAGE_SIZE  = 10;               // Indeed visar 10 jobb/sida
const PAUSE_MS   = 1200;             // paus mellan sidor (ms)
const DEFAULT_Q  = 'fullstack utvecklare';
const ANT_KEY    = process.env.SCRAPINGANT_KEY || 'demo';
const PROXY      = process.env.HTTP_PROXY      || '';

// Minimal, egen UA‑uppsättning — slipper extern dependency
const UA_POOL = [
  // Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  // macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  // Linux / Wayland
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36'
];
const UA = UA_POOL[Math.floor(Math.random()*UA_POOL.length)];
const HEADERS = { 'User-Agent': UA, 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8' };

const xml   = new XMLParser({ ignoreAttributes: false });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const dbg   = (...m) => console.log(new Date().toISOString(), '[Indeed]', ...m);

const qEnc   = (s) => s.trim().split(/\s+/).join('+');
const deskUrl= (q,p,l)=>`https://se.indeed.com/jobs?q=${qEnc(q)}${l?`&l=${encodeURIComponent(l)}`:''}&sort=date&start=${p*PAGE_SIZE}`;
// Ny RSS‑sökväg: jobs?rss=1 – inga start‑parametrar accepteras men vi behåller q & l
const rssUrl = (q,l)=>`https://se.indeed.com/jobs?q=${qEnc(q)}${l?`&l=${encodeURIComponent(l)}`:''}&sort=date&rss=1`;

const norm   = (t)=>t.replace(/\s+/g,' ').trim();
const job    = (o) => ({ title:'', company:'', location:'', posted:'', summary:'', link:'', source:'', ...o });

/*****************************************************************
 * SHARED SELECTORS (Indeed 2025‑06)                             *
 *****************************************************************/
// Ny layout blandar <a class="tapItem">, <a class="slider_item">, div.cardOutline och div.jobTitle
const SELS = [
  'a.tapItem',
  'a.slider_item',
  'a.cardOutline',           // nytt 2025
  '.job_seen_beacon',
  '[data-tn-component="organicJob"]',
  'div.jobsearch-SerpJobCard',
  'div.jobTitle'             // reserv‑knutpunkt
];
const SEL_JOIN = SELS.join(',');

/*****************************************************************
 * 1️⃣  RSS (Försök 1)                                           *
 *****************************************************************/
async function rssFetch(q,l){
  const url = rssUrl(q,l);
  try{
    dbg('RSS  →',url);
    const {data,status}=await axios.get(url,{headers:HEADERS,timeout:15000,responseType:'text',validateStatus:s=>s<500});
    if(status>=400 || typeof data!=='string' || !data.trim().startsWith('<?xml')){dbg('RSS tom',status);return [];}    
    const items = xml.parse(data)?.rss?.channel?.item ?? [];
    const res   = items.map(it=>job({
      title   : it.title??'',
      company : (it.author??'').replace(/^Company: */i,''),
      location: (it.location??l)||'',
      posted  : it.pubDate??'',
      summary : norm((it.description??'').replace(/<[^>]+>/g,'')),
      link    : it.link??'',
      source  : 'indeed-rss-new'
    }));
    dbg('RSS  OK',res.length);
    return res;
  }catch(e){dbg('RSS  fel',e.message);return [];}  
}

/*****************************************************************
 * 2️⃣  SCRAPINGANT (Försök 2)                                   *
 *****************************************************************/
async function antFetch(q,p,l){
  if(ANT_KEY==='demo'){dbg('Ant  — hoppar över (ingen SCRAPINGANT_KEY)');return [];}  
  const target = deskUrl(q,p,l);
  const antUrl = `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(target)}&x-api-key=${ANT_KEY}&browser=true`;
  try{
    dbg('Ant  →',antUrl);
    const {data,status}=await axios.get(antUrl,{headers:{'x-api-key':ANT_KEY},timeout:45000,responseType:'text'});
    if(status!==200||typeof data!=='string'){dbg('Ant  status',status);return[];}
    const $=load(data);
    const res=parseHtml($,'indeed-ant');
    dbg('Ant  OK',res.length);
    return res;
  }catch(e){dbg('Ant  fel',e.message);return[];}
}

/*****************************************************************
 * 3️⃣  CLOUDSCRAPER (Försök 3)                                  *
 *****************************************************************/
async function cloudFetch(q,p,l){
  const url = deskUrl(q,p,l);
  try{
    dbg('Cloud→',url);
    const html = await cloudscraper.get({uri:url,headers:HEADERS,gzip:true,timeout:45000,proxy:PROXY||undefined,resolveWithFullResponse:false});
    if(/<title>.*(Verification|Attention Required|Security Check).*<\/title>/i.test(html)){
      dbg('Cloudflare challenge');
      try{fs.writeFileSync(path.resolve(`challenge_${Date.now()}.html`),html);}catch{/*ignore*/}
      return [];
    }
    const $=load(html);
    const res=parseHtml($,'indeed-cloud');
    dbg('CloudOK',res.length);
    return res;
  }catch(e){dbg('Cloudfel',e.message);return[];}
}

/*****************************************************************
 * 4️⃣  PUPPETEER (Försök 4)                                     *
 *****************************************************************/
async function puppeteerFetch(q,p,l){
  let browser;
  try{
    const args=['--no-sandbox','--disable-setuid-sandbox'];
    if(PROXY) args.push(`--proxy-server=${PROXY}`);
    browser = await puppeteer.launch({headless:'new',args,timeout:60000});
  }catch(e){dbg('Puppeteer start',e.message);return [];}  
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setExtraHTTPHeaders({'Accept-Language':'sv-SE,sv;q=0.9,en;q=0.8'});
  await page.setRequestInterception(true);
  page.on('request',req=>/\.(png|jpe?g|gif|svg|webp|woff2?|ttf)$/i.test(req.url())?req.abort():req.continue());
  try{
    const url = deskUrl(q,p,l);
    dbg('Puppeteer→',url);
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});

    // ⬇️ NY LOGG – bekräftar aktuell URL EFTER ev. Cloudflare‑redirect
    dbg('Puppeteer landade på', await page.url());
    dbg('Puppeteer sidtitel:', await page.title());

    /*****************************************************************
     * 🔐 Cloudflare‑utmaning (auto‑klick + vänta på redirect)        *
     *****************************************************************/
    let triedClick=false;
    for(let attempt=0;attempt<2;attempt++){
      const title = await page.title();
      if(/(Verification|Attention Required|Additional Verification|Security Check)/i.test(title)){
        if(triedClick){dbg('Cloudflare fortfarande block – avbryter');break;}
        triedClick=true;
        dbg('Cloudflare page – skickar ett klick & väntar');
        const vp=page.viewport()||{width:500,height:500};
        await page.mouse.click(vp.width/2, vp.height/2, {delay:120});
        try{
          await Promise.race([
            page.waitForNavigation({waitUntil:'domcontentloaded',timeout:20000}),
            page.waitForNetworkIdle({idleTime:1500,timeout:20000})
          ]);
        }catch(_){/* ignore */}
        await sleep(1500); // ersätter page.waitForTimeout
        dbg('Efter klick – nu på', await page.url());
        continue; // kontrollera titel igen
      }
      break; // inte blockad längre
    }

    // Vänta på att minst ett job‑element skall dyka upp (15 sek timeout)
    try{
      await page.waitForSelector(SEL_JOIN,{timeout:15000});
    }catch(e){
      dbg('Inga job‑noder hittades inom timeout:', e.message);
    }

    // Scrolla endast om första försöket gav få noder (lazy‑load)
    let initialCount = await page.$$eval(SEL_JOIN, els=>els.length);
    dbg('Puppeteer – noder före scroll:', initialCount);
    if(initialCount<10){
      for(let i=0;i<10;i++){
        await page.evaluate(()=>window.scrollBy(0,1000));
        await sleep(700);
      }
    }

    // Spara snapshot om fortfarande inga noder – hjälper felsökning
    let nodeCount = await page.$$eval(SEL_JOIN, els=>els.length);
    if(nodeCount===0){
      try{
        const html = await page.content();
        const file = path.join(os.tmpdir(),`indeed_empty_${Date.now()}.html`);
        fs.writeFileSync(file,html,'utf8');
        dbg('⚠️ 0 noder – HTML snapshot sparad:',file);
      }catch{/*ignore*/}
    }

    const jobs = await page.evaluate((SELS)=>{
      const n=t=>t.replace(/\s+/g,' ').trim();
      const nodes=[...document.querySelectorAll(SELS.join(','))].filter(e=>e.querySelector('h2,h3,span.jobTitle'));
      return nodes.map(e=>{
        const g=s=>e.querySelector(s)?.innerText.trim()||'';
        const href=e.href||e.querySelector('a')?.href||'';
        return {
          title : g('h2 span:last-child')||g('h2')||g('h3')||g('span.jobTitle'),
          company: g('.companyName')||g('.company')||g('[data-testid="company-name"]'),
          location: g('.companyLocation')||g('.location')||g('[data-testid="text-location"]'),
          posted : g('.date')||g('.result-footer')||g('time')||'',
          summary: n(g('.job-snippet')||g('.summary')||g('[data-testid="job-snippet-text"]')||''),
          link   : href.startsWith('http')?href:`https://se.indeed.com${href}`,
          source : 'indeed-stealth'
        };
      });
    }, SELS);
    dbg('PuppeteerOK',jobs.length);
    if(jobs.length){ dbg('Puppeteer första titel:', jobs[0].title); }
    await browser.close();
    return jobs;
  }catch(e){dbg('Puppeteer fel',e.message);await browser.close();return[];}
}

/*****************************************************************
 * HTML‑→ Job helper (Cheerio)                                   *
 *****************************************************************/
function parseHtml($,src){
  const res=[];
  $(SEL_JOIN).each((_,el)=>{
    const c=$(el);
    const href=c.attr('href')||c.find('a').attr('href')||'';
    const ttl = norm(c.find('h2 span').last().text()||c.find('h2').text()||c.find('h3').text()||c.find('span.jobTitle').text());
    if(!ttl) return; // hoppa över annonser
    res.push(job({
      title   : ttl,
      company : norm(c.find('.companyName,.company,[data-testid="company-name"]').text()),
      location: norm(c.find('.companyLocation,.location,[data-testid="text-location"]').text()),
      posted  : norm(c.find('.date,.result-footer,time').text()),
      summary : norm(c.find('.job-snippet,.summary,[data-testid="job-snippet-text"]').text()),
      link    : href.startsWith('http')?href:`https://se.indeed.com${href}`,
      source  : src
    }));
  });
  return res;
}

/*****************************************************************
 * AGGREGATOR                                                   *
 *****************************************************************/
export async function scrapeIndeedJobs(pages=1,q=DEFAULT_Q,l=''){
  dbg('Start', {pages,q,l});
  const out=[];
  // Första försök: nya RSS‑endpoint (inget page‑begrepp i RSS)
  const rssJobs = await rssFetch(q,l);
  if(rssJobs.length) out.push(...rssJobs);

  for(let i=0;i<pages;i++){
    dbg(`── Page ${i+1}/${pages}`);
    let jobs = [];
    if(!jobs.length) jobs=await antFetch(q,i,l);
    if(!jobs.length) jobs=await cloudFetch(q,i,l);
    if(jobs.length<5) jobs=[...jobs, ...await puppeteerFetch(q,i,l)];

    dbg('Samlade',jobs.length,'jobb');
    if(!jobs.length){dbg('Stop – inga jobb, bryter loopen');break;}
    out.push(...jobs);
    await sleep(PAUSE_MS);
  }
  dbg('Klart →',out.length,'totalt');
  return out;
}

/*****************************************************************
 * CLI helper (npm start)
 * -------------------------------------------------------------
 *  › npm start [pages] [query] [location] [outfile.json]
 *****************************************************************/
if(import.meta.url===`file://${process.argv[1]}` || import.meta.url===process.argv[1]){
  (async()=>{
    const [,,pArg,qArg,lArg,outFile] = process.argv;
    const pages = parseInt(pArg||'1',10);
    const qry   = qArg ?? DEFAULT_Q;
    const loc   = lArg ?? '';
    const jobs  = await scrape
  })
}