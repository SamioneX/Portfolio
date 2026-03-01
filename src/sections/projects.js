import { renderProjectCard } from '../components/project-card.js'

export function renderProjects() {
  // Load all JSON files in data/. Files starting with _ are schema/templates and
  // are excluded by checking for a valid meta.status field.
  const modules = import.meta.glob('../data/*.json', { eager: true })

  const projects = Object.values(modules)
    .map(mod => mod.default ?? mod)
    .filter(data => data?.meta?.status === 'live' || data?.meta?.status === 'in-progress')
    .sort((a, b) => {
      const statusRank = s => s === 'live' ? 0 : 1
      const byStatus = statusRank(a.meta.status) - statusRank(b.meta.status)
      if (byStatus !== 0) return byStatus
      // Both live — sort by completed_month descending (most recent first)
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

  projects.forEach((data, index) => {
    if (index > 0) {
      const divider = document.createElement('div')
      divider.className = 'card-divider'
      wrapper.appendChild(divider)
    }
    wrapper.appendChild(renderProjectCard(data))
  })

  return wrapper
}
