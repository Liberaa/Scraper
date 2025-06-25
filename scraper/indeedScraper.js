import { scrapeJobTechJobs } from './sources/jobtech.js';
import { scrapeJobbSafariJobs } from './sources/jobbsafari.js';
import { scrapeAnySiteJobs } from './sources/anySite.js';

export async function scrapeIndeedJobs() {
  console.log('🚀 Startar scraping...');

  const [jobtechJobs, jobbSafariJobs, evolutionJobs] = await Promise.all([
    scrapeJobTechJobs(),
    scrapeJobbSafariJobs(),
    scrapeAnySiteJobs()          // ← Evolution
  ]);

  const combined = [...jobtechJobs, ...jobbSafariJobs, ...evolutionJobs];

  console.log(`✅ Totalt ${combined.length} jobb hittades.`);
  return combined;
}
