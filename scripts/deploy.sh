#!/usr/bin/env bash
# Full infrastructure deploy — runs once to provision everything.
# Subsequent site deployments are handled by GitHub Actions (push to main).
#
# Prerequisites:
#   - AWS CLI configured (aws configure) or CDK_DEFAULT_ACCOUNT / AWS_PROFILE set
#   - .env file at repo root with CLOUDFLARE_TOKEN and GITHUB_REPO
#   - Node.js 20+ installed
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
OUTPUTS_FILE="/tmp/sokech-cdk-outputs-$$.json"

# ── Load .env ──────────────────────────────────────────────────────────────
if [[ ! -f "$REPO_ROOT/.env" ]]; then
  echo "✗ Missing $REPO_ROOT/.env — copy .env.example and fill in values."
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$REPO_ROOT/.env"
set +a

: "${CLOUDFLARE_TOKEN:?CLOUDFLARE_TOKEN must be set in .env}"

# ── Seed Cloudflare token to AWS Secrets Manager ───────────────────────────
SECRET_NAME="/sokech/cloudflare-token"
echo "▸ Seeding Cloudflare token to Secrets Manager ($SECRET_NAME)..."
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" > /dev/null 2>&1; then
  aws secretsmanager update-secret \
    --secret-id "$SECRET_NAME" \
    --secret-string "$CLOUDFLARE_TOKEN" > /dev/null
  echo "  Updated."
else
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "$CLOUDFLARE_TOKEN" > /dev/null
  echo "  Created."
fi

# ── Install CDK dependencies ───────────────────────────────────────────────
echo "▸ Installing CDK dependencies..."
cd "$INFRA_DIR"
npm ci --quiet

# ── Bootstrap (safe to re-run; no-op if already done) ─────────────────────
echo "▸ Bootstrapping CDK environment..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap "aws://${ACCOUNT_ID}/us-east-1" --quiet

# ── Deploy CertStack ───────────────────────────────────────────────────────
# Custom resource Lambda adds Cloudflare validation CNAMEs and polls ACM
# until the certificate is ISSUED (usually 1–3 min). No manual DNS steps needed.
echo "▸ Deploying CertStack (ACM cert + Cloudflare validation)..."
npx cdk deploy SokechCertStack --require-approval never

# ── Deploy SiteStack ───────────────────────────────────────────────────────
# Creates S3, CloudFront, GitHub OIDC role, and updates Cloudflare CNAMEs.
echo "▸ Deploying SiteStack (S3 + CloudFront + GitHub OIDC + Cloudflare DNS)..."
npx cdk deploy SokechSiteStack --require-approval never --outputs-file "$OUTPUTS_FILE"

# ── Print next steps ───────────────────────────────────────────────────────
ROLE_ARN=$(node -p      "require('$OUTPUTS_FILE').SokechSiteStack.DeployRoleArn")
SITE_DOMAIN=$(node -p   "require('$OUTPUTS_FILE').SokechSiteStack.SiteDistDomain")
ASSETS_DOMAIN=$(node -p "require('$OUTPUTS_FILE').SokechSiteStack.AssetsDistDomain")

echo ""
echo "✔ Deployment complete!"
echo ""
echo "── Step 1: Add GitHub secret ────────────────────────────────────────────"
echo "  Repo → Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "  AWS_ROLE_ARN = $ROLE_ARN"
echo ""
echo "  (S3 bucket and CloudFront dist ID are discovered automatically from"
echo "   CloudFormation outputs at deploy time — no additional secrets needed.)"
echo ""
echo "── Step 2: Verify Cloudflare DNS records ────────────────────────────────"
echo "  All three CNAMEs were provisioned automatically by the Lambda custom resource."
echo "  Verify in Cloudflare Dashboard → DNS that each record is DNS-only (grey cloud):"
echo ""
echo "  CNAME  sokech.com        →  $SITE_DOMAIN"
echo "  CNAME  www.sokech.com    →  $SITE_DOMAIN"
echo "  CNAME  assets.sokech.com →  $ASSETS_DOMAIN"
echo ""
echo "  ⚠ Do NOT enable Cloudflare proxy (orange cloud) on these records —"
echo "    it conflicts with CloudFront's own TLS termination."
echo ""
echo "── Step 3: Push to main to trigger first site deployment ────────────────"
echo "  git push origin main"

rm -f "$OUTPUTS_FILE"
