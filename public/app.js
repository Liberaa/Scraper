document.getElementById('scrapeBtn').addEventListener('click', async () => {
  await fetch('/api/jobs/scrape', { method: 'POST' })
  loadJobs()
})

async function loadJobs() {
  const res = await fetch('/api/jobs')
  const jobs = await res.json()
  const list = document.getElementById('jobList')
  list.innerHTML = ''
  jobs.forEach(job => {
    const li = document.createElement('li')
    li.innerHTML = `<strong>${job.title}</strong> - ${job.company} (${job.location}) <a href="${job.url}" target="_blank">Apply</a>`
    list.appendChild(li)
  })
}

loadJobs()
