/**
 * Renders a project card from a JSON blueprint object.
 * Applies all null/empty rules from CLAUDE.md.
 * @param {Object} data - Project JSON data
 * @returns {HTMLElement} - The rendered project card article
 */
export function renderProjectCard(data, index = 0) {
  const { meta, header, summary, motivation, architecture, highlights, metrics, stack, challenges, demo } = data

  const card = document.createElement('article')
  card.className = 'project-card reveal'

  // ── HEADER ────────────────────────────────────────────
  const statusBadge = meta.status === 'live'
    ? `<span class="status-badge live">Live</span>`
    : `<span class="status-badge wip">In Progress</span>`

  const liveBtn = header.live_url
    ? `<a href="${header.live_url}" class="link-btn primary" target="_blank" rel="noopener">↗ Live Demo</a>`
    : ''

  const githubBtn = header.github_url
    ? `<a href="${header.github_url}" class="link-btn ghost" target="_blank" rel="noopener">GitHub →</a>`
    : ''

  const cardHeader = document.createElement('header')
  cardHeader.className = 'card-header'
  cardHeader.innerHTML = `
    <div>
      <p class="project-number">Project ${String(index + 1).padStart(2, '0')}</p>
      <h2 class="project-title">${header.title}</h2>
      <p class="project-subtitle">${header.subtitle}</p>
      ${statusBadge}
    </div>
    <div class="header-links">
      ${liveBtn}
      ${githubBtn}
    </div>
  `
  card.appendChild(cardHeader)

  // ── BODY ──────────────────────────────────────────────
  const body = document.createElement('div')
  body.className = 'card-body'

  // 1. Summary
  body.innerHTML += `
    <div>
      <p class="section-label">What it is</p>
      <p class="summary-text">${summary.plain_english}</p>
    </div>
  `

  // 2. Motivation
  body.innerHTML += `
    <div>
      <p class="section-label">Why I built it</p>
      <div class="problem-block">"${motivation.quote}"</div>
    </div>
  `

  // 3. Architecture diagram (full-width)
  if (architecture.diagram_path) {
    body.innerHTML += `
      <div class="full-width arch-diagram">
        <p class="section-label">Architecture</p>
        <img
          src="${architecture.diagram_path}"
          alt="${architecture.diagram_alt || 'Architecture diagram'}"
          loading="lazy"
        >
        ${architecture.flow_summary ? `<p class="arch-flow">${architecture.flow_summary}</p>` : ''}
      </div>
    `
  } else {
    body.innerHTML += `
      <div class="full-width">
        <p class="section-label">Architecture</p>
        <div class="arch-placeholder">
          [ Architecture diagram — draw.io / Excalidraw export goes here ]<br>
          <small style="opacity:0.5;margin-top:0.5rem;display:block">${architecture.flow_summary || ''}</small>
        </div>
      </div>
    `
  }

  // 4. Highlights (what I built)
  if (highlights.items?.length) {
    body.innerHTML += `
      <div>
        <p class="section-label">What I built</p>
        <ul class="highlights-list">
          ${highlights.items.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `
  }

  // 5. Metrics (by the numbers)
  const visibleMetrics = metrics.items?.filter(m => m.value && m.value !== '') ?? []
  if (visibleMetrics.length) {
    body.innerHTML += `
      <div>
        <p class="section-label">By the numbers</p>
        <div class="metrics-grid">
          ${visibleMetrics.map(m => `
            <div class="metric">
              <div class="metric-value">${m.value}</div>
              <div class="metric-label">${m.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
  }

  // 6. Tech stack (full-width)
  const awsTags    = (stack.aws               ?? []).map(t => `<span class="tag aws">${t}</span>`).join('')
  const langTags   = (stack.languages          ?? []).map(t => `<span class="tag lang">${t}</span>`).join('')
  const toolTags   = (stack.frameworks_tools   ?? []).map(t => `<span class="tag tool">${t}</span>`).join('')
  const otherTags  = (stack.concepts_patterns  ?? []).map(t => `<span class="tag other">${t}</span>`).join('')
  const allTags = awsTags + langTags + toolTags + otherTags

  if (allTags) {
    body.innerHTML += `
      <div class="full-width">
        <p class="section-label">Stack</p>
        <div class="tech-tags">${allTags}</div>
      </div>
    `
  }

  // 7. Challenges & learnings (full-width)
  if (challenges.items?.length) {
    body.innerHTML += `
      <div class="full-width">
        <p class="section-label">Challenges &amp; learnings</p>
        <ul class="learnings-list">
          ${challenges.items.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `
  }

  // 8. Screenshots carousel (full-width, optional)
  const shots = demo?.screenshot_paths
  if (Array.isArray(shots) && shots.length) {
    body.innerHTML += `
      <div class="full-width">
        <p class="section-label">Screenshots</p>
        <div class="screenshot-strip">
          ${shots.map((src, i) => `
            <img
              src="${src}"
              alt="Screenshot ${i + 1} of ${header.title}"
              loading="lazy"
            >
          `).join('')}
        </div>
      </div>
    `
  }

  card.appendChild(body)

  // ── FOOTER ────────────────────────────────────────────
  const certsLine = meta.certs_applied?.length
    ? `<p class="footer-meta">Certs applied: <span>${meta.certs_applied.join(' · ')}</span></p>`
    : ''

  const teamLabel = meta.team_size ? ` · ${meta.team_size}` : ''
  const durationLabel = meta.duration_weeks ? ` · ~${meta.duration_weeks} weeks` : ''

  const cardFooter = document.createElement('footer')
  cardFooter.className = 'card-footer'
  cardFooter.innerHTML = `
    <p class="footer-meta">
      Completed <span>${meta.completed_month}</span>${teamLabel}${durationLabel}
    </p>
    ${certsLine}
  `
  card.appendChild(cardFooter)

  return card
}
