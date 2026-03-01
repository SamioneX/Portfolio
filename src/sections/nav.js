export function renderNav() {
  const nav = document.createElement('nav')
  nav.className = 'nav'
  nav.setAttribute('aria-label', 'Main navigation')
  nav.innerHTML = `
    <a href="#hero" class="nav-logo">sokech<span>.</span></a>
    <ul class="nav-links" id="nav-links">
      <li><a href="#about">About</a></li>
      <li><a href="#experience">Experience</a></li>
      <li><a href="#projects">Projects</a></li>
      <li><a href="#certifications">Certifications</a></li>
      <li><a href="#contact">Contact</a></li>
    </ul>
    <div class="nav-right">
      <a href="/resume.pdf" class="link-btn ghost" target="_blank" rel="noopener">Download CV</a>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  `

  // Sticky blur on scroll
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60)
  }, { passive: true })

  // Hamburger toggle
  const hamburger = nav.querySelector('#nav-hamburger')
  const links = nav.querySelector('#nav-links')
  hamburger.addEventListener('click', () => {
    const open = links.classList.toggle('open')
    hamburger.classList.toggle('open', open)
    hamburger.setAttribute('aria-expanded', String(open))
  })

  // Close mobile menu on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open')
      hamburger.classList.remove('open')
      hamburger.setAttribute('aria-expanded', 'false')
    })
  })

  return nav
}
