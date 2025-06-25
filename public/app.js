window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('scrapeBtn');
  const jobList = document.getElementById('jobList');

  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/jobs/scrape', { method: 'POST' });
        const data = await res.json();
        console.log('Scrape result:', data);
        loadJobs();
      } catch (err) {
        console.error('Error scraping jobs:', err);
      }
    });
  }

  async function loadJobs() {
    try {
      const res = await fetch('/api/jobs');
      const jobs = await res.json();
      renderJobs(jobs);
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }

  function renderJobs(jobs) {
    jobList.innerHTML = '';
    jobs.forEach(job => {
      const card = document.createElement('div');
      card.classList.add('job-card');
      card.innerHTML = `
        <h3>${job.title}</h3>
        <p><strong>Företag:</strong> ${job.company}</p>
        <p><strong>Plats:</strong> ${job.location}</p>
        <p class="description">${job.description}</p>
        <a href="${job.url}" target="_blank" class="apply-button">Ansök</a>
      `;
      jobList.appendChild(card);
    });
  }

  // 🎯 Filterlogik
  const filterBtn = document.getElementById('applyFilters');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      const tech = document.getElementById('filterTech').value.toLowerCase();
      const location = document.getElementById('filterLocation').value.toLowerCase();
      const type = document.getElementById('filterType').value.toLowerCase();

      const cards = document.querySelectorAll('.job-card');
      cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        const match =
          (!tech || text.includes(tech)) &&
          (!location || text.includes(location)) &&
          (!type || text.includes(type));
        card.style.display = match ? 'block' : 'none';
      });
    });
  }

  loadJobs();
});
