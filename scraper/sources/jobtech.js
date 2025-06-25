import axios from 'axios';

export async function scrapeJobTechJobs() {
  const url = 'https://jobsearch.api.jobtechdev.se/search';
  const query = {
    q: 'javascript node.js',
    offset: 0,
    limit: 50,
    municipality: ['0180', '1480', '1280'], // Stockholm, Göteborg, Malmö
  };

  try {
    console.log('🌐 Hämtar från JobTech...');

    const { data } = await axios.get(url, {
      params: query,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'job-scraper/1.0',
      },
    });

    if (!data.hits) {
      console.warn('⚠️ Ingen data från JobTech API');
      return [];
    }

    console.log(`✅ JobTech hittade ${data.hits.length} jobb.`);

    return data.hits.map((job) => ({
      title: job.headline,
      company: job.employer?.name || 'Okänt företag',
      location: job.workplace_address?.municipality || 'Sverige',
      url: job.webpage_url,
      description: job.description?.text?.slice(0, 250) || '',
    }));
  } catch (error) {
    console.error('❌ JobTech-fel:', error.message);
    return [];
  }
}
