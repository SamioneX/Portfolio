import site from '../data/site.json'

function tags(items, cls) {
  return items.map(t => `<span class="tag ${cls}">${t}</span>`).join('')
}

export function renderAbout() {
  const { bio, stack } = site.about

  const section = document.createElement('section')
  section.id = 'about'
  section.className = 'section'
  section.innerHTML = `
    <div class="section-header reveal">
      <p class="section-eyebrow">About</p>
      <h2 class="section-title">Who I am</h2>
    </div>
    <div class="about-body">
      <div class="about-bio reveal">
        ${bio.map(p => `<p>${p}</p>`).join('')}
      </div>
      <div class="about-stack reveal reveal-delay-2">
        <p class="section-label">Stack</p>
        <div class="stack-group">
          <p class="stack-group-label">AWS</p>
          <div class="tech-tags">${tags(stack.aws, 'aws')}</div>
        </div>
        <div class="stack-group">
          <p class="stack-group-label">Languages</p>
          <div class="tech-tags">${tags(stack.languages, 'lang')}</div>
        </div>
        <div class="stack-group">
          <p class="stack-group-label">Frameworks &amp; Tools</p>
          <div class="tech-tags">${tags(stack.tools, 'tool')}</div>
        </div>
        <div class="stack-group">
          <p class="stack-group-label">Patterns</p>
          <div class="tech-tags">${tags(stack.concepts, 'other')}</div>
        </div>
      </div>
    </div>
  `
  return section
}
