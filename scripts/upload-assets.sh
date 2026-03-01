#!/usr/bin/env bash
# Upload project assets from assets-staging/<slug>/ to s3://sokech-com-assets/<slug>/
#
# Usage:
#   ./scripts/upload-assets.sh <project-slug>
#   ./scripts/upload-assets.sh cloudclips
#
# Expected local layout:
#   assets-staging/
#   └── cloudclips/
#       ├── screenshots/
#       │   ├── home.png
#       │   └── upload-flow.png
#       ├── diagrams/
#       │   └── architecture.png
#       └── demo.mp4
#
# Resulting CDN URLs (use in src/data/<slug>.json):
#   https://assets.sokech.com/<slug>/screenshots/home.png
#   https://assets.sokech.com/<slug>/diagrams/architecture.png
#   https://assets.sokech.com/<slug>/demo.mp4
#
# Prerequisites:
#   AWS CLI configured with a profile or environment that can write to sokech-com-assets.
#   (After running scripts/deploy.sh the deploy role has s3:PutObject on the assets bucket.)

set -euo pipefail

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <project-slug>"
  echo "  e.g. $0 cloudclips"
  exit 1
fi

STAGING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/assets-staging/${SLUG}"
BUCKET="sokech-com-assets"
S3_PREFIX="s3://${BUCKET}/${SLUG}"
CDN_PREFIX="https://assets.sokech.com/${SLUG}"

if [[ ! -d "$STAGING_DIR" ]]; then
  echo "✗ Directory not found: $STAGING_DIR"
  echo "  Create it and place your assets inside."
  exit 1
fi

echo "▸ Uploading ${SLUG} assets to ${S3_PREFIX} ..."

# Images and diagrams — long-lived cache (1 year)
aws s3 sync "$STAGING_DIR" "$S3_PREFIX" \
  --exclude "*.mp4" \
  --exclude ".DS_Store" \
  --exclude "*/.DS_Store" \
  --cache-control "public, max-age=31536000, immutable"

# Videos — long-lived cache + byte-range support (enabled by default in S3/CloudFront)
find "$STAGING_DIR" -name "*.mp4" | while read -r f; do
  key="${f#"$STAGING_DIR/"}"
  aws s3 cp "$f" "${S3_PREFIX}/${key}" \
    --cache-control "public, max-age=31536000, immutable" \
    --content-type "video/mp4"
done

echo ""
echo "✔ Upload complete. CDN URLs for src/data/${SLUG}.json:"
echo ""

find "$STAGING_DIR" -type f -not -name ".DS_Store" | sort | while read -r f; do
  rel="${f#"$STAGING_DIR/"}"
  echo "  ${CDN_PREFIX}/${rel}"
done

echo ""
echo "  Update screenshot_paths, diagram_path, and video_demo_url in src/data/${SLUG}.json"
echo "  then delete assets-staging/${SLUG}/ (it is gitignored)."
