import site from '../data/site.json'

export function renderHero() {
  const { name, title, tagline, cv_url } = site.hero

  const section = document.createElement('section')
  section.id = 'hero'
  section.className = 'hero'
  section.innerHTML = `
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-inner">
      <p class="hero-eyebrow">sokech.com</p>
      <h1 class="hero-name">${name}</h1>
      <p class="hero-title">${title}</p>
      <p class="hero-tagline">${tagline}</p>
      <div class="hero-ctas">
        <a href="#projects" class="link-btn primary">View Projects ↓</a>
        <a href="${cv_url}" class="link-btn ghost" target="_blank" rel="noopener">Download CV</a>
      </div>
    </div>
    <p class="hero-scroll-hint" aria-hidden="true">↓ scroll</p>
  `

  // Smooth scroll for the "View Projects" anchor
  section.querySelector('a[href="#projects"]').addEventListener('click', e => {
    e.preventDefault()
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
  })

  return section
}
