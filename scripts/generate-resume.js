#!/usr/bin/env node
// Generates public/resume.pdf from src/data/site.json and src/data/*.json project files.
// Run: node scripts/generate-resume.js
// Also invoked automatically in CI before `npm run build`.

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── Load site data ──────────────────────────────────────────────────────────

const site = JSON.parse(readFileSync(resolve(root, 'src/data/site.json'), 'utf8'))

// Load all project JSONs, skip _* files, filter to live/in-progress.
// Sort: live projects first, then in-progress; within each group sort by meta.order.
const dataDir = resolve(root, 'src/data')
const statusRank = s => s === 'live' ? 0 : 1
const projects = readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'site.json')
  .map(f => JSON.parse(readFileSync(resolve(dataDir, f), 'utf8')))
  .filter(p => p?.meta?.status === 'live' || p?.meta?.status === 'in-progress')
  .sort((a, b) => {
    const byStatus = statusRank(a.meta.status) - statusRank(b.meta.status)
    return byStatus !== 0 ? byStatus : (a.meta?.order ?? 99) - (b.meta?.order ?? 99)
  })

const topProjects = projects.slice(0, 3)
const hasMore = projects.length > 3

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Extract a contact link value by label
function contactHref(label) {
  return site.contact.links.find(l => l.label === label)?.href ?? ''
}

// Separate experience entries: education vs professional
const isEducation = r => /^(bachelor|master|doctor|phd)/i.test(r)
const professionalExp = site.experience.filter(e => !isEducation(e.role))
const education = site.experience.filter(e => isEducation(e.role))

// ── HTML generation ─────────────────────────────────────────────────────────

function renderExperienceEntries(entries) {
  return entries.map(e => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${esc(e.role)}</span>
        <span class="entry-date">${esc(e.date)}</span>
      </div>
      <div class="entry-sub">${esc(e.company)}</div>
      <p style="font-size:10.5pt; margin-top:4px;">${esc(e.description)}</p>
    </div>
  `).join('')
}

function renderProjectEntries() {
  return topProjects.map(p => {
    const date = p.meta.status === 'live'
      ? esc(p.meta.completed_month ?? '')
      : 'In Progress'
    const links = [
      p.header.live_url ? `Live: <a href="${esc(p.header.live_url)}">${esc(p.header.live_url.replace(/^https?:\/\//, ''))}</a>` : null,
      p.header.github_url ? `Source: <a href="${esc(p.header.github_url)}">${esc(p.header.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, 'github.com/'))}</a>` : null,
    ].filter(Boolean).join(' &nbsp;·&nbsp; ')
    const bullets = (p.highlights?.items ?? []).slice(0, 3)
    return `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-title">${esc(p.header.title)} — ${esc(p.header.subtitle)}</span>
          <span class="entry-date">${date}</span>
        </div>
        ${links ? `<div class="entry-sub">${links}</div>` : ''}
        <ul>
          ${bullets.map(b => `<li>${esc(b)}</li>`).join('')}
        </ul>
      </div>
    `
  }).join('')
}

const emailHref = contactHref('Email').replace('mailto:', '')
const githubHref = contactHref('GitHub').replace(/^https?:\/\//, '')
const linkedinHref = contactHref('LinkedIn').replace(/^https?:\/\//, '')

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #111;
      background: #fff;
      max-width: 780px;
      margin: 0 auto;
      padding: 48px;
    }

    .name { font-size: 22pt; font-weight: bold; letter-spacing: 0.02em; margin-bottom: 4px; }
    .title-line { font-size: 11pt; color: #333; margin-bottom: 2px; }
    .contact-line { font-size: 10pt; color: #333; margin-bottom: 2px; }
    .contact-line a { color: #111; text-decoration: none; }

    .section { margin-top: 20px; }
    .section-title {
      font-size: 11pt; font-weight: bold; text-transform: uppercase;
      letter-spacing: 0.08em; border-bottom: 1px solid #111;
      padding-bottom: 3px; margin-bottom: 10px;
    }

    .entry { margin-bottom: 14px; }
    .entry-header {
      display: flex; justify-content: space-between;
      align-items: baseline; flex-wrap: wrap; gap: 4px;
    }
    .entry-title { font-weight: bold; font-size: 11pt; }
    .entry-date  { font-size: 10pt; color: #333; white-space: nowrap; }
    .entry-sub   { font-size: 10pt; color: #333; margin-bottom: 4px; }
    ul { padding-left: 18px; margin-top: 4px; }
    li { margin-bottom: 3px; font-size: 10.5pt; }

    .skills-table { width: 100%; border-collapse: collapse; }
    .skills-table td { vertical-align: top; padding: 2px 0; font-size: 10.5pt; }
    .skills-table td:first-child {
      font-weight: bold; width: 26%;
      padding-right: 8px; white-space: nowrap;
    }

    .cert-list { list-style: none; padding: 0; }
    .cert-list li {
      display: flex; justify-content: space-between;
      font-size: 10.5pt; margin-bottom: 3px;
    }

    .more-projects { font-style: italic; font-size: 10pt; color: #555; margin-top: 6px; }

    @media print {
      body { padding: 32px 40px; font-size: 10.5pt; }
      a { color: #111 !important; text-decoration: none !important; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="name">${esc(site.hero.name)}</div>
  <div class="title-line">${esc(site.hero.title)}</div>
  <div class="contact-line">
    ${emailHref ? `<a href="mailto:${esc(emailHref)}">${esc(emailHref)}</a> &nbsp;|&nbsp;` : ''}
    ${githubHref ? `<a href="https://${esc(githubHref)}">${esc(githubHref)}</a> &nbsp;|&nbsp;` : ''}
    ${linkedinHref ? `<a href="https://${esc(linkedinHref)}">${esc(linkedinHref)}</a> &nbsp;|&nbsp;` : ''}
    <a href="https://sokech.com">sokech.com</a>
  </div>

  <div class="section">
    <div class="section-title">Summary</div>
    <p style="font-size:10.5pt;">${esc(site.about.bio[0])}</p>
  </div>

  <div class="section">
    <div class="section-title">Technical Skills</div>
    <table class="skills-table">
      <tr><td>Cloud &amp; Infra</td><td>${esc(site.about.stack.aws.join(', '))}</td></tr>
      <tr><td>Languages</td><td>${esc(site.about.stack.languages.join(', '))}</td></tr>
      <tr><td>Frameworks</td><td>${esc(site.about.stack.tools.join(', '))}</td></tr>
      <tr><td>Practices</td><td>${esc(site.about.stack.concepts.join(', '))}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Professional Experience</div>
    ${renderExperienceEntries(professionalExp)}
  </div>

  <div class="section">
    <div class="section-title">Projects</div>
    ${renderProjectEntries()}
    ${hasMore ? `<p class="more-projects">More projects available at <a href="https://sokech.com">sokech.com</a></p>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Certifications</div>
    <ul class="cert-list">
      ${site.certifications.map(c => `
        <li><span>${esc(c.name)}</span><span>${esc(c.date)}</span></li>
      `).join('')}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">Education</div>
    ${renderExperienceEntries(education)}
  </div>

</body>
</html>`

// ── Render to PDF ────────────────────────────────────────────────────────────

const outPath = resolve(root, 'public/resume.pdf')

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'domcontentloaded' })
const pdf = await page.pdf({
  format: 'A4',
  printBackground: false,
  margin: { top: '1cm', right: '1.5cm', bottom: '1cm', left: '1.5cm' },
})
await browser.close()

import { writeFileSync } from 'fs'
writeFileSync(outPath, pdf)
console.log(`Resume written to ${outPath}`)
