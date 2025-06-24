window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('scrapeBtn')
  const jobList = document.getElementById('jobList')

  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/jobs/scrape', { method: 'POST' })
        const data = await res.json()
        console.log('Scrape result:', data)
        loadJobs()
      } catch (err) {
        console.error('Error scraping jobs:', err)
      }
    })
  }

  async function loadJobs() {
    try {
      const res = await fetch('/api/jobs')
      const jobs = await res.json()
      jobList.innerHTML = ''
      jobs.forEach(job => {
        const li = document.createElement('li')
        li.innerHTML = `<strong>${job.title}</strong> - ${job.company} (${job.location}) <a href="${job.url}" target="_blank">Apply</a>`
        jobList.appendChild(li)
      })
    } catch (err) {
      console.error('Error loading jobs:', err)
    }
  }

  loadJobs()
})
