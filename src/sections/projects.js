import { renderProjectCard } from '../components/project-card.js'

export function renderProjects() {
  // Load all JSON files in data/. Files starting with _ are schema/templates and
  // are excluded by checking for a valid meta.status field.
  const modules = import.meta.glob('../data/*.json', { eager: true })

  const projects = Object.values(modules)
    .map(mod => mod.default ?? mod)
    .filter(data => data?.meta?.status === 'live' || data?.meta?.status === 'in-progress')
    .sort((a, b) => (a.meta?.order ?? 99) - (b.meta?.order ?? 99))

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
