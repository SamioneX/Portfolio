export const DOMAIN = 'sokech.com'

// Secrets Manager path where scripts/deploy.sh seeds the Cloudflare API token.
// Lambdas read from here at runtime — the token is never in CloudFormation templates
// or Lambda environment variables.
export const CLOUDFLARE_SECRET_NAME = '/sokech/cloudflare-token'
