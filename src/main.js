import './style.css'
import { renderNav }            from './sections/nav.js'
import { renderHero }           from './sections/hero.js'
import { renderAbout }          from './sections/about.js'
import { renderExperience }     from './sections/experience.js'
import { renderCertifications } from './sections/certifications.js'
import { renderProjects }       from './sections/projects.js'
import { renderContact }        from './sections/contact.js'

const app = document.getElementById('app')

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
})

app.appendChild(renderContact())

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

window.addEventListener('scroll', checkReveal, { passive: true })
checkReveal()
