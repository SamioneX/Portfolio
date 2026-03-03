import { marked } from 'marked'
import { renderSampleUsageModal, openModal } from './modal.js'

/**
 * Extract the first code block from markdown HTML and truncate to preview length
 * @param {string} html - Rendered markdown HTML
 * @returns {string} - HTML snippet of the first code block (max ~3 lines)
 */
function extractFirstCodeBlock(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const preBlock = doc.querySelector('pre code')

  if (!preBlock) return null

  const lines = preBlock.textContent.split('\n')
  const trimmedLines = lines.slice(0, 4).join('\n').trim()
  const truncated = trimmedLines.length > 200 ? trimmedLines.substring(0, 200) + '...' : trimmedLines

  return `<pre><code>${truncated}</code></pre>`
}

/**
 * Renders a project card from a JSON blueprint object.
 * Applies all null/empty rules from CLAUDE.md.
 * @param {Object} data - Project JSON data
 * @returns {Promise<HTMLElement>} - The rendered project card article
 */
export async function renderProjectCard(data, index = 0) {
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

  // custom extra links (array of {title,url}) rendered as ghost buttons
  const otherBtns = Array.isArray(header.other_links)
    ? header.other_links.map(l => {
        if (!l || !l.url || !l.title) return ''
        return `<a href="${l.url}" class="link-btn ghost" target="_blank" rel="noopener">${l.title}</a>`
      }).join('')
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
      ${otherBtns}
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

  // 8. Sample usage markdown (full-width, optional)
  const sampleUsageUrl = demo?.sample_usage_url
  if (sampleUsageUrl) {
    try {
      const response = await fetch(sampleUsageUrl)
      if (response.ok) {
        const markdown = await response.text()
        const markdownHtml = await marked(markdown)
        const previewBlock = extractFirstCodeBlock(markdownHtml)

        console.log(`[Sample Usage] Fetched from ${sampleUsageUrl}`, {
          markdownLength: markdown.length,
          htmlLength: markdownHtml.length,
          previewFound: !!previewBlock
        })

        if (previewBlock) {
          // Create modal element — IMPORTANT: DO NOT APPEND TO CARD BODY
          //
          // Modals use `position: fixed` for centering and fullscreen overlay.
          // If appended as a child of the card's body element, the fixed positioning
          // becomes relative to the card's position (not the viewport). This breaks:
          // 1. Centering calculations (flexbox aligns relative to card, not viewport)
          // 2. Z-stacking and overlay behavior (card's z-index context interferes)
          // 3. Layout reflow (especially on first open when content dimensions aren't cached)
          //
          // SOLUTION: Create modal in memory, keep it detached from the card.
          // openModal() will ensure it's a direct child of document.body before making
          // it visible, ensuring proper fixed positioning and centering on all clicks.
          const modal = renderSampleUsageModal(markdownHtml, header.title)

          // Add preview card with click handler
          const previewDiv = document.createElement('div')
          previewDiv.className = 'full-width'
          previewDiv.innerHTML = `
            <p class="section-label">Sample Usage</p>
            <div style="border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; background: var(--subtle); cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;" class="sample-usage-preview" data-modal-trigger="">
              <div style="flex: 1; font-family: var(--font-mono); font-size: 0.85em; color: var(--green); overflow: hidden;">
                ${previewBlock}
              </div>
              <div style="margin-left: 1rem; font-size: 0.9em; color: var(--muted); white-space: nowrap;">View full →</div>
            </div>
          `

          // Add click handler to preview
          previewDiv.querySelector('.sample-usage-preview').addEventListener('click', () => {
            openModal(modal)
          })

          body.appendChild(previewDiv)
        } else {
          console.warn(`[Sample Usage] No code block found in markdown for ${header.title}`)
        }
      } else {
        console.warn(`Failed to fetch sample usage from ${sampleUsageUrl}: ${response.status}`)
      }
    } catch (error) {
      console.warn(`Error loading sample usage from ${sampleUsageUrl}:`, error.message)
    }
  }

  // 9. Video demo (full-width, optional)
  const videoUrl = demo?.video_demo_url
  if (videoUrl) {
    body.innerHTML += `
      <div class="full-width">
        <p class="section-label">Demo</p>
        <video
          src="${videoUrl}"
          controls
          preload="metadata"
          style="width: 100%; border-radius: 0.5rem; background: #0a0a0a;"
        ></video>
      </div>
    `
  }

  // 10. Screenshots carousel (full-width, optional)
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
  const teamLabel = meta.team_size ? ` · ${meta.team_size}` : ''
  const durationLabel = meta.duration_weeks ? ` · ~${meta.duration_weeks} weeks` : ''

  const cardFooter = document.createElement('footer')
  cardFooter.className = 'card-footer'
  cardFooter.innerHTML = `
    <p class="footer-meta">
      Completed <span>${meta.completed_month}</span>${teamLabel}${durationLabel}
    </p>
  `
  card.appendChild(cardFooter)

  return card
}
