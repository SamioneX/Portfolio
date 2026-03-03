# sokech.com — Personal Portfolio

Live at **[sokech.com](https://sokech.com)** · Deployed automatically on push to `main`.

A static personal portfolio site deployed globally on AWS. Built with Vite and vanilla JavaScript, infrastructure managed with AWS CDK, DNS automated through Cloudflare, and deployed via GitHub Actions with OIDC authentication — no AWS credentials stored anywhere.

---

## Architecture

![Architecture diagram](https://assets.sokech.com/portfolio/diagrams/portfolio-arch.png)

```
Visitor → Cloudflare DNS (CNAME Flattening)
        → CloudFront (HTTPS, HTTP/2+3, OAC)
        → S3 private bucket (sokech-com-site)

GitHub push to main
        → GitHub Actions (OIDC token)
        → IAM Role assumption
        → S3 sync + CloudFront invalidation

CDK deploy
        → Lambda custom resource
        → Cloudflare API
        → DNS CNAME upserts
```

### CDK Stacks

| Stack | What it provisions |
|-------|-------------------|
| `SokechCertStack` | ACM certificate for `sokech.com`, `www.sokech.com`, `assets.sokech.com` — DNS validation automated via Cloudflare Lambda |
| `SokechSiteStack` | S3 buckets (site + assets), CloudFront distributions, GitHub OIDC deploy role, Cloudflare CNAME updates |

See [`infra/README.md`](infra/README.md) for full infrastructure details.

---

## Repo Layout

```
portfolio/
├── .env.example                    # Environment variable template (copy to .env)
├── .github/workflows/deploy.yml    # GitHub Actions CI/CD pipeline
├── infra/                          # AWS CDK infrastructure (see infra/README.md)
│   ├── bin/app.ts                  # CDK app entry point
│   ├── lib/
│   │   ├── cert-stack.ts           # ACM cert + Cloudflare DNS validation
│   │   └── site-stack.ts           # S3 + CloudFront + IAM + DNS
│   └── lambda/
│       ├── cert-validator/         # Custom resource: ACM cert lifecycle
│       └── cf-dns/                 # Custom resource: Cloudflare CNAME upserts
├── scripts/
│   ├── deploy.sh                   # One-command infrastructure bootstrap
│   ├── upload-assets.sh            # Upload media to assets CDN
│   └── generate-resume.js          # Build-time PDF generator (runs in CI)
├── public/
│   └── assets/certs/               # AWS badge PNGs (referenced from site.json)
├── src/
│   ├── index.html                  # Single-page entry point
│   ├── main.js                     # Section orchestration + scroll animations
│   ├── style.css                   # Design system (fonts, colors, components)
│   ├── sections/                   # One JS module per page section
│   ├── components/project-card.js  # Project card renderer
│   └── data/
│       ├── site.json               # All personal content (bio, experience, certs)
│       ├── _PROJECT_TEMPLATE.json  # Schema reference — not loaded at runtime
│       ├── cloudclips.json         # CloudClips project blueprint
│       ├── infrakit.json           # InfraKit project blueprint
│       └── sentinelapi.json        # SentinelAPI project blueprint
└── assets-staging/                 # gitignored — local staging area for CDN uploads
```

---

## Deploying from Scratch

These steps are only needed once to provision the AWS infrastructure. After that, every push to `main` deploys automatically.

### Prerequisites

- AWS CLI configured (`aws configure`) with permissions to create IAM, S3, CloudFront, ACM, Lambda, and Secrets Manager resources
- Node.js 20+
- A Cloudflare account managing `sokech.com`

### Step 1 — Create `.env`

```bash
cp .env.example .env
# Edit .env and fill in CLOUDFLARE_TOKEN
```

**Getting a Cloudflare API token:**
1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a token with `Zone / DNS / Edit` permission for the `sokech.com` zone
3. Paste the token as `CLOUDFLARE_TOKEN` in `.env`

The token is read from `.env` and seeded into AWS Secrets Manager — it is never baked into CloudFormation templates or Lambda environment variables.

### Step 2 — Run the bootstrap script

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The script handles everything automatically:

1. Seeds `CLOUDFLARE_TOKEN` from `.env` to Secrets Manager at `/sokech/cloudflare-token`
2. Bootstraps the CDK environment in `us-east-1`
3. Deploys `SokechCertStack` — requests the ACM certificate and automates DNS validation through Cloudflare (no manual DNS steps)
4. Deploys `SokechSiteStack` — creates S3 buckets, CloudFront distributions, GitHub OIDC role, and upserts Cloudflare CNAMEs
5. Prints the IAM role ARN needed for the next step

### Step 3 — Add GitHub secret (one manual step)

After `deploy.sh` completes it prints the deploy role ARN:

```
AWS_ROLE_ARN = arn:aws:iam::ACCOUNT_ID:role/sokech-github-actions-deploy
```

Add it to the repo: **GitHub → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|-------|
| `AWS_ROLE_ARN` | The role ARN printed by `deploy.sh` |

That's it. Push to `main` and the first automated deployment runs.

> **Note:** The S3 bucket name and CloudFront distribution ID are **not** needed as GitHub secrets — the CI pipeline discovers them automatically from CloudFormation stack outputs at deploy time.

---

## Local Development

```bash
npm install
npm run dev              # → http://localhost:5173
npm run build            # Production build → dist/
npm run preview          # Preview production build locally
npm run generate-resume  # Regenerate public/resume.pdf from JSON data
```

---

## Day-to-Day Content Updates

All personal content lives in `src/data/site.json`. Edit it and push — no code changes needed.

### Update bio, tagline, experience, or contact links

Edit [`src/data/site.json`](src/data/site.json). Fields: `hero`, `about`, `experience`, `certifications`, `contact`, `footer`.

### Add a certification

1. Add an entry to `certifications` in `src/data/site.json`:

```json
{
  "short": "SAP",
  "name": "AWS Certified Solutions Architect – Professional",
  "date": "Month DD, YYYY",
  "note": "One line describing what it validates.",
  "badge": "/assets/certs/your-badge-filename.png",
  "credlyUrl": "https://www.credly.com/badges/your-badge-id/public_url"
}
```

2. Place the badge PNG in `public/assets/certs/`.
3. Commit and push.

### Add a new project

1. Copy `src/data/_PROJECT_TEMPLATE.json` → `src/data/yourproject.json`
2. Fill in all fields. Key ones:
   - `meta.status` — `"live"` (green badge) or `"in-progress"` (amber badge). Anything else hides the card.
   - `meta.completed_month` — e.g. `"Mar 2026"`. Used for sort order (most recent first).
   - `meta.slug` — must match the folder name used for assets (e.g. `"cloudclips"`)
3. If you have any non‑standard links (PyPI, docs, package registry, etc.) add an `other_links` array with objects `{title,url}`.
4. Upload assets if you have them (see below).
5. Commit and push — the card appears automatically.

**Null/empty field behaviour (no code changes needed):**

| Field | When null/empty |
|-------|----------------|
| `header.live_url` | Live Demo button hidden |
| `header.github_url` | GitHub button hidden |
| `header.other_links` | Render each entry as an extra header button; leave blank for none |
| `architecture.diagram_path` | Replaced by `flow_summary` text placeholder |
| `metrics.items[].value` | That tile hidden |
| `demo.screenshot_paths` | No screenshot carousel |
| `demo.video_demo_url` | No video embed |

### Upload project assets (screenshots, diagrams, videos)

Assets are served from `assets.sokech.com` (S3 + CloudFront). The upload script syncs a local staging folder to S3.

```bash
# 1. Stage files locally (this folder is gitignored):
mkdir -p assets-staging/yourproject/screenshots/
mkdir -p assets-staging/yourproject/diagrams/
# Copy screenshots, diagrams, demo.mp4 into the appropriate subdirectories.

# 2. Upload to S3 (requires AWS CLI configured with access to sokech-com-assets):
./scripts/upload-assets.sh yourproject

# 3. Reference in yourproject.json using the CDN URL pattern:
#    "https://assets.sokech.com/yourproject/screenshots/home.png"
#    "https://assets.sokech.com/yourproject/diagrams/arch.png"
#    "https://assets.sokech.com/yourproject/demo.mp4"
```

---

## Resume PDF

Auto-generated at CI time from `src/data/site.json` and all project JSON files — never edit it manually.

To preview locally before pushing:

```bash
npm run generate-resume
# → writes public/resume.pdf
```

The PDF includes: name, contact links, bio, skills, experience, education, certifications, and the top 3 most recently completed projects. If there are more than 3 projects, a "More projects at sokech.com" line is added automatically.

---

## CI/CD

**Trigger:** push to `main`
**Auth:** GitHub OIDC — no static AWS credentials stored anywhere
**Required secret:** `AWS_ROLE_ARN` only — S3 bucket and CloudFront distribution ID are discovered automatically from CloudFormation stack outputs at runtime.

**Pipeline steps:**

| Step | What it does |
|------|-------------|
| `npm ci` | Install dependencies (including Puppeteer) |
| `node scripts/generate-resume.js` | Generate resume PDF from JSON data |
| `npm run build` | Vite production build → `dist/` |
| Configure AWS (OIDC) | Exchange GitHub OIDC token for short-lived AWS credentials |
| Discover targets | Read S3 bucket + CloudFront dist ID from `SokechSiteStack` CloudFormation outputs |
| Sync assets | `aws s3 sync` with `immutable` cache headers (excludes `index.html` and `resume.pdf`) |
| Upload `resume.pdf` | `aws s3 cp` with `no-cache, no-store, must-revalidate` — browsers always re-fetch the latest |
| Upload `index.html` | `aws s3 cp` with `no-cache` |
| Invalidate CloudFront | `/*` invalidation — clears CDN cache globally |
