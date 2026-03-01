#!/usr/bin/env node
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env from the repo root so GITHUB_REPO is available when running cdk directly.
// The deploy script also seeds CLOUDFLARE_TOKEN to Secrets Manager before calling cdk.
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import * as cdk from 'aws-cdk-lib'
import { CertStack } from '../lib/cert-stack'
import { SiteStack } from '../lib/site-stack'

const githubRepo = process.env.GITHUB_REPO ?? 'SamioneX/portfolio'

const app = new cdk.App()

const certStack = new CertStack(app, 'SokechCertStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
})

const siteStack = new SiteStack(app, 'SokechSiteStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  certificate: certStack.certificate,
  githubRepo,
})

siteStack.addDependency(certStack)
