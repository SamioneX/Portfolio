import site from '../data/site.json'

export function renderContact() {
  const { heading, tagline, links } = site.contact
  const { text: footerText } = site.footer

  const section = document.createElement('section')
  section.id = 'contact'
  section.className = 'contact-section'
  section.innerHTML = `
    <div class="contact-inner">
      <div class="reveal">
        <p class="section-eyebrow">Contact</p>
        <h2 class="section-title">${heading}</h2>
      </div>
      <p class="contact-lmia reveal">${tagline}</p>
      <div class="contact-links reveal">
        ${links.map(l => `
          <a
            href="${l.href}"
            class="contact-link ${l.primary ? 'primary' : ''}"
            ${l.download ? 'download' : ''}
            ${l.external ? 'target="_blank" rel="noopener"' : ''}
          >
            <span aria-hidden="true">${l.icon}</span>
            ${l.label}
          </a>
        `).join('')}
      </div>
      <footer class="site-footer reveal">
        <p>${footerText}</p>
        <p>© ${new Date().getFullYear()}</p>
      </footer>
    </div>
  `
  return section
}
