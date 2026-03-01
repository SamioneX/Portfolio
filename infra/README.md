# Infrastructure — sokech.com

AWS CDK infrastructure for sokech.com. Two stacks in `us-east-1` provision ACM certificates, S3 buckets, CloudFront distributions, a GitHub OIDC deploy role, and automate Cloudflare DNS — with no manual DNS steps and no stored credentials.

> **Do not run `cdk deploy` directly.** Use `scripts/deploy.sh` from the repo root. It seeds the Cloudflare token to Secrets Manager before CDK runs — without it, the cert-validator Lambda will fail on first deploy.

---

## Stacks

### `SokechCertStack`

Requests an ACM certificate for `sokech.com`, `www.sokech.com`, and `assets.sokech.com`, and automates DNS validation through a Lambda-backed CloudFormation custom resource.

**Why a custom resource?** CDK's native `Certificate` construct only supports Route 53 for DNS validation. Since DNS is managed by Cloudflare, the Lambda reads the ACM-issued validation CNAMEs from the ACM API, provisions them in Cloudflare via the API, and polls until the certificate reaches `ISSUED` before signalling CloudFormation success. This avoids the CloudFormation deadlock where CFn blocks on cert issuance before the validation records can be added.

**Lambda lifecycle:**

| Event | Action |
|-------|--------|
| `Create` | `RequestCertificate` → read validation CNAMEs → provision in Cloudflare → poll until `ISSUED` |
| `Update` | No-op — returns existing cert ARN stored in `PhysicalResourceId` |
| `Delete` | `DeleteCertificate` |

**Outputs:**

| Output | Value |
|--------|-------|
| `CertificateArn` | ACM cert ARN — passed to `SiteStack` as a cross-stack reference |

---

### `SokechSiteStack`

Creates the full site infrastructure and wires up Cloudflare DNS.

**Resources:**

| Resource | Name / Details |
|----------|---------------|
| S3 — site bucket | `sokech-com-site` · private, OAC-protected, serves the portfolio |
| S3 — assets bucket | `sokech-com-assets` · private, OAC-protected, serves project media |
| CloudFront — site dist | Aliases: `sokech.com`, `www.sokech.com` · HTTP/2+3 · TLS 1.2+ · OAC |
| CloudFront — assets dist | Alias: `assets.sokech.com` · CORS headers · HTTP/2+3 |
| IAM OIDC role | `sokech-github-actions-deploy` · scoped to `SamioneX/Portfolio` repo |
| Custom resource | Cloudflare CNAME upserts on every stack deploy |

**GitHub OIDC role permissions (minimal):**

| Permission | Scope |
|------------|-------|
| `s3:PutObject`, `s3:DeleteObject` | `sokech-com-site` bucket objects |
| `s3:ListBucket` | `sokech-com-site` bucket |
| `cloudfront:CreateInvalidation` | Site CloudFront distribution only |
| `cloudformation:DescribeStacks` | `SokechSiteStack` only |

**Outputs:**

| Output | Used by |
|--------|---------|
| `DeployRoleArn` | Add as `AWS_ROLE_ARN` GitHub secret (one-time manual step) |
| `SiteBucketName` | Discovered by GitHub Actions at deploy time from CloudFormation |
| `SiteDistributionId` | Discovered by GitHub Actions at deploy time from CloudFormation |
| `SiteDistDomain` | CloudFront domain — Cloudflare CNAME target for `sokech.com` / `www` |
| `AssetsDistDomain` | CloudFront domain — Cloudflare CNAME target for `assets.sokech.com` |

---

## Lambda Custom Resources

### `lambda/cert-validator/`

Manages the full ACM certificate lifecycle as a CloudFormation custom resource. Reads Cloudflare credentials at runtime from Secrets Manager at `/sokech/cloudflare-token`.

**IAM grants:**
- `acm:RequestCertificate`, `acm:DescribeCertificate`, `acm:DeleteCertificate` — scoped to `*` (cert ARN is not known before request)
- `secretsmanager:GetSecretValue` — scoped to `/sokech/cloudflare-token`

### `lambda/cf-dns/`

Upserts Cloudflare DNS CNAME records for all three domains on every CDK deploy. Triggered by the `CfDnsRecords` custom resource in `SiteStack`. Re-runs whenever distribution IDs or the `Version` property changes, keeping DNS self-healing after any infrastructure change.

**IAM grants:**
- `secretsmanager:GetSecretValue` — scoped to `/sokech/cloudflare-token`

---

## CDK Commands

```bash
cd infra
npm ci

# Preview CloudFormation templates without deploying
npx cdk synth

# Show what would change for a specific stack
npx cdk diff SokechSiteStack
npx cdk diff SokechCertStack

# Deploy all stacks (use scripts/deploy.sh from repo root instead — handles secrets first)
npx cdk deploy --all --require-approval never
```

---

## Secrets and Configuration

| Secret / Config | Where it lives | Who reads it |
|----------------|---------------|--------------|
| `CLOUDFLARE_TOKEN` | `.env` (local only, gitignored) → seeded to Secrets Manager by `deploy.sh` | cert-validator Lambda, cf-dns Lambda |
| `/sokech/cloudflare-token` | AWS Secrets Manager | Lambda custom resources at runtime |
| `AWS_ROLE_ARN` | GitHub repo secret (set manually after first deploy) | GitHub Actions workflow |
| `GITHUB_REPO` | `.env` → read by CDK app at synth time | `SiteStack` OIDC trust policy |

**To update the Cloudflare token** (e.g. rotation):

```bash
# Option A — re-run deploy.sh (re-deploys infrastructure, token is re-seeded first):
./scripts/deploy.sh

# Option B — update Secrets Manager directly without a CDK deploy:
aws secretsmanager update-secret \
  --secret-id /sokech/cloudflare-token \
  --secret-string "YOUR_NEW_TOKEN"
```

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | 20+ | CDK, Lambda runtime |
| AWS CLI | v2 | CDK deploy, Secrets Manager |
| `aws configure` or `CDK_DEFAULT_ACCOUNT` | — | CDK bootstrapping |
