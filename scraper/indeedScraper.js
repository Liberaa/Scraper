import { scrapeJobTechJobs   } from './sources/jobtech.js';
import { scrapeJobbSafariJobs} from './sources/jobbsafari.js';
import { scrapeAnySiteJobs   } from './sources/anySite.js';
import { scrapeIndeedJobs as scrapeIndeedSource } from './sources/indeed.js'; // 👈 alias

export async function scrapeIndeedJobs(pages = 1) {
  console.log('🚀 Startar scraping...');

  const [
    jobtechJobs,
    jobbSafariJobs,
    evolutionJobs,
    indeedJobs                          // 👈 NY array
  ] = await Promise.all([
    scrapeJobTechJobs(),
    scrapeJobbSafariJobs(),
    scrapeAnySiteJobs(),                // ← Evolution
    scrapeIndeedSource(pages)           // 👈 anropa källan
  ]);

  const combined = [
    ...jobtechJobs,
    ...jobbSafariJobs,
    ...evolutionJobs,
    ...indeedJobs                       // 👈 lägg till
  ];

  console.log(`✅ Totalt ${combined.length} jobb hittades.`);
  return combined;
}
