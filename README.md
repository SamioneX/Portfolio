# sokech.com — Personal Portfolio

Live at **sokech.com**. Deployed automatically on push to `main`.

---

## Updating Site Content

### Add or edit personal info (bio, experience, contact)

Edit **`src/data/site.json`** — no code changes needed.

Fields you'll find there: hero tagline, about bio, experience timeline entries, certifications, contact links, footer text.

---

### Add a new certification

1. Add a new entry to the `certifications` array in `src/data/site.json`:

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
3. Commit and push — deploys automatically.

---

### Add a new project

Each project is a standalone JSON file in `src/data/`. The card renderer discovers them automatically at build time.

1. Copy `src/data/_PROJECT_TEMPLATE.json` → `src/data/newproject.json`
2. Fill in the fields. Key ones:
   - `meta.status` — `"in-progress"` or `"live"` (anything else hides the card)
   - `meta.order` — controls sort order on the page (lower = higher up)
   - `meta.slug` — must match the folder name used for assets (e.g. `"cloudclips"`)
3. Upload assets if you have them (see below).
4. Commit and push.

**Null/empty field behaviour (no code changes needed):**
- `header.live_url` null → Live Demo button hidden
- `header.github_url` null → GitHub button hidden
- `architecture.diagram_path` null → replaced by `flow_summary` text placeholder
- `metrics.items[].value` empty → that metric tile hidden
- `demo.screenshot_paths` empty → no screenshot carousel
- `demo.video_demo_url` null → no video embed

---

### Upload project assets (screenshots, diagrams, videos)

Assets are served from `assets.sokech.com` (S3 + CloudFront). The upload script syncs a local staging folder to S3.

```bash
# 1. Stage the files locally (this folder is gitignored):
assets-staging/
  yourproject/
    screenshots/
      home.png
    diagrams/
      arch.png
    demo.mp4

# 2. Run the upload script:
./scripts/upload-assets.sh yourproject

# 3. Reference them in the JSON using the CDN URL pattern:
#    https://assets.sokech.com/{slug}/screenshots/home.png
#    https://assets.sokech.com/{slug}/diagrams/arch.png
#    https://assets.sokech.com/{slug}/demo.mp4
```

---

## CI/CD

- **Trigger:** push to `main`
- **Auth:** OIDC — no static AWS credentials stored
- **Required secret:** `AWS_ROLE_ARN` (already set in GitHub repo secrets)
- S3 bucket and CloudFront distribution ID are discovered automatically from CloudFormation outputs at deploy time

---

*Full infrastructure and architecture documentation to be written separately.*
