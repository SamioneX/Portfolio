import site from '../data/site.json'

function renderCert(cert, index) {
  const badgeEl = cert.badge
    ? `<img src="${cert.badge}" alt="${cert.short} badge" class="cert-badge-img" onerror="this.replaceWith(document.querySelector('.cert-badge-placeholder-tpl').content.cloneNode(true))">`
    : `<div class="cert-badge-placeholder">${cert.short}</div>`

  return `
    <a
      href="${cert.credlyUrl}"
      class="cert-card reveal reveal-delay-${index + 1}"
      target="_blank"
      rel="noopener"
      aria-label="${cert.name} — verify on Credly"
    >
      ${badgeEl}
      <p class="cert-name">${cert.name}</p>
      <p class="cert-date">Issued ${cert.date}</p>
      <p class="cert-note">${cert.note}</p>
      <p class="cert-verify">Verify on Credly ↗</p>
    </a>
  `
}

export function renderCertifications() {
  const section = document.createElement('section')
  section.id = 'certifications'
  section.className = 'section'
  section.innerHTML = `
    <div class="section-header reveal">
      <p class="section-eyebrow">Certifications</p>
      <h2 class="section-title">AWS Certified</h2>
    </div>
    <div class="cert-grid">
      ${site.certifications.map((c, i) => renderCert(c, i)).join('')}
    </div>
  `

  // Graceful badge fallback: if image fails to load, show the short text placeholder
  section.querySelectorAll('.cert-badge-img').forEach(img => {
    img.addEventListener('error', () => {
      const placeholder = document.createElement('div')
      placeholder.className = 'cert-badge-placeholder'
      placeholder.textContent = img.alt.replace(' badge', '')
      img.replaceWith(placeholder)
    })
  })

  return section
}
