import site from '../data/site.json'

function renderEntry(entry, index) {
  return `
    <div class="timeline-item reveal reveal-delay-${Math.min(index + 1, 4)}">
      <div class="timeline-dot"></div>
      <p class="timeline-date">${entry.date}</p>
      <p class="timeline-role">${entry.role}</p>
      <p class="timeline-company">${entry.company}</p>
      <p class="timeline-desc">${entry.description}</p>
    </div>
  `
}

export function renderExperience() {
  const section = document.createElement('section')
  section.id = 'experience'
  section.className = 'section'
  section.innerHTML = `
    <div class="section-header reveal">
      <p class="section-eyebrow">Experience</p>
      <h2 class="section-title">Background</h2>
    </div>
    <div class="timeline">
      ${site.experience.map((e, i) => renderEntry(e, i)).join('')}
      <div class="timeline-item">
        <div class="timeline-dot muted-dot"></div>
        <p class="timeline-muted">Additional work experience available on request.</p>
      </div>
    </div>
  `
  return section
}
