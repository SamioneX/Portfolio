import { renderProjectCard } from '../components/project-card.js'

export async function renderProjects() {
  // Load all JSON files in data/. Files starting with _ are schema/templates and
  // are excluded by checking for a valid meta.status field.
  const modules = import.meta.glob('../data/*.json', { eager: true })

  const score = proj => {
    let points = 0
    if (proj.header?.live_url) points++
    if (proj.header?.github_url) points++
    if (Array.isArray(proj.header?.other_links) && proj.header.other_links.length) points++
    const demo = proj.demo || {}
    if ((Array.isArray(demo.screenshot_paths) && demo.screenshot_paths.length) || demo.video_demo_url || demo.sample_usage_url) points++
    return points
  }

  const projects = Object.values(modules)
    .map(mod => mod.default ?? mod)
    .filter(data => data?.meta?.status === 'live' || data?.meta?.status === 'in-progress')
    .sort((a, b) => {
      const statusRank = s => s === 'live' ? 0 : 1
      const byStatus = statusRank(a.meta.status) - statusRank(b.meta.status)
      if (byStatus !== 0) return byStatus

      // same status, score higher first
      const scA = score(a)
      const scB = score(b)
      if (scB !== scA) return scB - scA

      // tiebreaker: most recent completed_month
      const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }
      const parseMonth = str => { const [m, y] = (str ?? '').split(' '); return months[m] !== undefined ? new Date(+y, months[m]) : null }
      const da = parseMonth(a.meta.completed_month), db = parseMonth(b.meta.completed_month)
      return (da && db) ? db - da : 0
    })

  const wrapper = document.createElement('section')
  wrapper.id = 'projects'
  wrapper.className = 'projects-section'

  const header = document.createElement('div')
  header.className = 'projects-section-header'
  header.innerHTML = `
    <p class="section-eyebrow reveal">Projects</p>
    <h2 class="section-title reveal">What I build</h2>
  `
  wrapper.appendChild(header)

  // Render all project cards (async) and append them
  const cardPromises = projects.map((data, index) => renderProjectCard(data, index))
  const cards = await Promise.all(cardPromises)

  cards.forEach((card, index) => {
    if (index > 0) {
      const divider = document.createElement('div')
      divider.className = 'card-divider'
      wrapper.appendChild(divider)
    }
    wrapper.appendChild(card)
  })

  return wrapper
}
