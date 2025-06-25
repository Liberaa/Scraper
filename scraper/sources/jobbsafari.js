import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeJobbSafariJobs() {
  const url = 'https://remoteok.com/remote-javascript-jobs';

  try {
    console.log('🌐 Hämtar från RemoteOK...');

    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(html);
    const results = [];

    $('tr.job').each((_, el) => {
      const $el = $(el);
      const title = $el.find('td.company_and_position h2').text().trim();
      const company =
        $el.find('td.company_and_position h3').text().trim() || 'Okänt företag';
      const location = $el.find('div.location').text().trim() || 'Remote';
      const relativeUrl = $el.attr('data-href');
      const urlFull = relativeUrl ? `https://remoteok.com${relativeUrl}` : null;
      const desc = $el.find('td.description').text().trim().slice(0, 250);

      if (title && urlFull) {
        results.push({
          title,
          company,
          location,
          url: urlFull,
          description: desc,
        });
      }
    });

    console.log(`✅ RemoteOK hittade ${results.length} jobb.`);
    return results;
  } catch (error) {
    console.error('❌ RemoteOK-fel:', error.message);
    return [];
  }
}
