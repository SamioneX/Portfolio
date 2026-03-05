import './style.css'
import { renderNav }            from './sections/nav.js'
import { renderHero }           from './sections/hero.js'
import { renderAbout }          from './sections/about.js'
import { renderExperience }     from './sections/experience.js'
import { renderCertifications } from './sections/certifications.js'
import { renderProjects }       from './sections/projects.js'
import { renderContact }        from './sections/contact.js'

const app = document.getElementById('app')
let projectsReady = false

// Nav is fixed-position, inserted directly into body (before #app)
document.body.insertBefore(renderNav(), app)

// Sections append into #app in reading order
app.appendChild(renderHero())
app.appendChild(renderAbout())
app.appendChild(renderExperience())
app.appendChild(renderCertifications())

// renderProjects is async due to markdown fetching
renderProjects().then(projectsSection => {
  app.appendChild(projectsSection)
  app.appendChild(renderContact())
  projectsReady = true
  scrollToHashTarget()
})

// ── Scroll-triggered reveal animation ─────────────────
// Checks all un-revealed elements on each scroll event, and once immediately
// so elements already in the viewport (e.g. after anchor navigation) show up.
function checkReveal() {
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      el.classList.add('visible')
    }
  })
}

function resolveHashTargetId(hash) {
  if (!hash || hash === '#') return null
  const value = decodeURIComponent(hash.replace(/^#/, ''))
  if (value.startsWith('projects/')) {
    const slug = value.slice('projects/'.length).trim()
    return slug ? `project-${slug}` : null
  }
  return value
}

function scrollToHashTarget() {
  const targetId = resolveHashTargetId(window.location.hash)
  if (!targetId) return
  const target = document.getElementById(targetId)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  checkReveal()
}

window.addEventListener('scroll', checkReveal, { passive: true })
window.addEventListener('hashchange', () => {
  if (!projectsReady) return
  scrollToHashTarget()
})
checkReveal()
