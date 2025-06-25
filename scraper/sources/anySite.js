// sources/anySite.js
import axios from 'axios';

/**
 * Hämta junior-/entry-jobb från valfria Greenhouse-boards.
 *
 * @param {Object}   [opts]
 * @param {string[]} [opts.slugs]          – boards, t.ex. ['spotify','klarna']
 * @param {string[]} [opts.skillKeywords]  – teknik (måste matcha titel ELLER text)
 * @param {string[]} [opts.levelKeywords]  – juniornivå (måste matcha titel ELLER text)
 * @param {RegExp}   [opts.locationRegex]  – plats-filter (Remote eller SE är default)
 */
export async function scrapeAnySiteJobs({
  slugs = ['spotify', 'klarna', 'remotecom', 'vercel'],
  skillKeywords = ['javascript', 'node'],
  levelKeywords = ['junior', 'intern', 'graduate', 'entry', 'trainee', 'associate'],
  locationRegex = /remote|sweden|sverige|stockholm|gothenburg|goteborg|göteborg|malmö|malmo|uppsala|lund|umeå|umea|linköping|linkoping|örebro|orebro/i
} = {}) {
  const skillReg = new RegExp(skillKeywords.join('|'), 'i');
  const levelReg = new RegExp(levelKeywords.join('|'), 'i');

  async function fetchBoard(slug) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    console.log(`🌐 Hämtar ${slug}…`);

    try {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      });

      const company = slug.charAt(0).toUpperCase() + slug.slice(1);

      return data.jobs
        .filter(j =>
          (skillReg.test(j.title) || skillReg.test(j.content)) &&   // teknik
          (levelReg.test(j.title) || levelReg.test(j.content)) &&   // juniornivå
          (!locationRegex || locationRegex.test(j.location?.name))  // plats
        )
        .map(j => ({
          title: j.title.trim(),
          company,
          location: j.location?.name ?? company,
          url: j.absolute_url,
          description: j.content.replace(/<[^>]+>/g, '').slice(0, 280)
        }));
    } catch (err) {
      console.error(`❌ ${slug}-fel:`, err.message);
      return [];
    }
  }

  const all = (await Promise.all(slugs.map(fetchBoard))).flat();
  console.log(`✅ Hittade ${all.length} junior-jobb (Remote/Sverige) över ${slugs.length} boards.`);
  return all;
}
