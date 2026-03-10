#!/usr/bin/env node
// Generates public/resume.pdf from src/data/resume.json and selected project JSON files.
// Run: node scripts/generate-resume.js
// Also invoked automatically in CI before `npm run build`.

import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dataDir = resolve(root, 'src/data')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function compactUrl(url) {
  return String(url ?? '').replace(/^https?:\/\//, '')
}

const resume = readJson(resolve(dataDir, 'resume.json'))
const projects = readdirSync(dataDir)
  .filter(file => file.endsWith('.json') && !file.startsWith('_') && file !== 'site.json' && file !== 'resume.json')
  .map(file => readJson(resolve(dataDir, file)))

const projectsBySlug = new Map(projects.map(project => [project.meta?.slug, project]))

function getProject(slug) {
  const project = projectsBySlug.get(slug)
  if (!project) {
    throw new Error(`Project slug "${slug}" referenced in resume.json was not found in src/data.`)
  }
  return project
}

function renderSkills() {
  return resume.skills.map(group => `
    <div class="skill-group">
      <span class="skill-label">${esc(group.label)}:</span> ${esc(group.items.join(', '))}
    </div>
  `).join('')
}

function renderExperience() {
  return resume.experience.map(item => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <div class="entry-title">${esc(item.role)} | ${esc(item.company)}</div>
          <div class="entry-sub">${esc(item.location)}</div>
        </div>
        <div class="entry-date">${esc(item.date)}</div>
      </div>
      <ul class="tight-list">
        ${item.bullets.map(bullet => `<li>${esc(bullet)}</li>`).join('')}
      </ul>
    </div>
  `).join('')
}

function renderFeaturedProjects() {
  return resume.projects.featured.map(item => {
    const project = getProject(item.slug)
    const links = [
      project.header?.github_url ? `<a href="${esc(project.header.github_url)}">${esc(compactUrl(project.header.github_url))}</a>` : null,
      project.header?.live_url ? `<a href="${esc(project.header.live_url)}">${esc(compactUrl(project.header.live_url))}</a>` : null
    ].filter(Boolean).join(' | ')

    return `
      <div class="entry">
        <div class="entry-header">
          <div class="entry-title">${esc(project.header.title)} | ${esc(project.header.subtitle)}</div>
          <div class="entry-date">${esc(project.meta.completed_month ?? '')}</div>
        </div>
        ${links ? `<div class="entry-sub">${links}</div>` : ''}
        <ul class="tight-list">
          ${item.bullets.map(bullet => `<li>${esc(bullet)}</li>`).join('')}
        </ul>
      </div>
    `
  }).join('')
}

function renderAdditionalProjects() {
  return resume.projects.additional.map(slug => {
    const project = getProject(slug)
    const url = project.header?.github_url || project.header?.live_url || `${resume.identity.website}#projects/${project.meta.slug}`
    return `<a href="${esc(url)}">${esc(project.header.title)}</a>`
  }).join(' | ')
}

function renderEducation() {
  return resume.education.map(item => `
    <div class="edu-item">
      <div class="entry-title">${esc(item.degree)}</div>
      <div class="entry-sub">${esc(item.school)} | ${esc(item.date)}</div>
      ${item.detail ? `<div class="edu-detail">${esc(item.detail)}</div>` : ''}
    </div>
  `).join('')
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      size: A4;
      margin: 0.35in;
    }

    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
      line-height: 1.2;
      font-size: 9.6pt;
    }

    a { color: #111; text-decoration: none; }
    p { margin: 0; }

    .header {
      border-bottom: 2px solid #111;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .name {
      font-size: 19pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      margin-bottom: 2px;
    }
    .title {
      font-size: 10.4pt;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .contact {
      font-size: 8.6pt;
      color: #333;
    }

    .summary {
      font-size: 8.9pt;
      margin-bottom: 10px;
    }

    .layout {
      display: grid;
      grid-template-columns: 1.7fr 1fr;
      gap: 14px;
      align-items: start;
    }

    .section {
      margin-bottom: 9px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 8.3pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #111;
      padding-bottom: 3px;
      margin-bottom: 6px;
    }

    .entry {
      margin-bottom: 7px;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: baseline;
    }
    .entry-title {
      font-size: 9.1pt;
      font-weight: 700;
    }
    .entry-date {
      font-size: 8.2pt;
      color: #333;
      white-space: nowrap;
    }
    .entry-sub {
      font-size: 8.3pt;
      color: #333;
      margin-top: 1px;
      margin-bottom: 2px;
    }

    .tight-list {
      margin: 2px 0 0 13px;
      padding: 0;
    }
    .tight-list li {
      margin: 0 0 1px 0;
      font-size: 8.45pt;
    }

    .skill-group {
      font-size: 8.35pt;
      margin-bottom: 3px;
    }
    .skill-label {
      font-weight: 700;
    }

    .edu-item {
      margin-bottom: 7px;
    }
    .edu-detail {
      font-size: 8.3pt;
      margin-top: 2px;
    }

    .cert-line,
    .additional-projects {
      font-size: 8.3pt;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="name">${esc(resume.identity.name)}</div>
    <div class="title">${esc(resume.identity.title)}</div>
    <div class="contact">
      ${esc(resume.identity.location)} | <a href="mailto:${esc(resume.identity.email)}">${esc(resume.identity.email)}</a> | <a href="${esc(resume.identity.github)}">${esc(compactUrl(resume.identity.github))}</a> | <a href="${esc(resume.identity.linkedin)}">${esc(compactUrl(resume.identity.linkedin))}</a> | <a href="${esc(resume.identity.website)}">${esc(compactUrl(resume.identity.website))}</a>
    </div>
  </div>

  <div class="summary">${esc(resume.summary)}</div>

  <div class="layout">
    <main>
      <div class="section">
        <div class="section-title">Experience</div>
        ${renderExperience()}
      </div>

      <div class="section">
        <div class="section-title">Projects</div>
        ${renderFeaturedProjects()}
        <div class="additional-projects"><strong>Additional:</strong> ${renderAdditionalProjects()}</div>
      </div>
    </main>

    <aside>
      <div class="section">
        <div class="section-title">Skills</div>
        ${renderSkills()}
      </div>

      <div class="section">
        <div class="section-title">Education</div>
        ${renderEducation()}
      </div>

      <div class="section">
        <div class="section-title">Certifications</div>
        <div class="cert-line">${esc(resume.certifications.join(' | '))}</div>
      </div>
    </aside>
  </div>
</body>
</html>`

const outPath = resolve(root, 'public/resume.pdf')
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'domcontentloaded' })
const pdf = await page.pdf({
  format: 'A4',
  preferCSSPageSize: true,
  printBackground: false,
  margin: { top: '0.35in', right: '0.35in', bottom: '0.35in', left: '0.35in' }
})
await browser.close()

writeFileSync(outPath, pdf)
console.log(`Resume written to ${outPath}`)
