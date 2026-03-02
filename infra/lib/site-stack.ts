import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as customResources from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'
import { DOMAIN, CLOUDFLARE_SECRET_NAME } from './constants'

interface SiteStackProps extends cdk.StackProps {
  certificate: acm.ICertificate
  githubRepo: string  // e.g. "SamioneX/portfolio"
}

export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps) {
    super(scope, id, props)

    // ── S3 Buckets ─────────────────────────────────────────────────────────

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: 'sokech-com-site',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: 'sokech-com-assets',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ── CloudFront: Site Distribution ──────────────────────────────────────

    const siteDist = new cloudfront.Distribution(this, 'SiteDist', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      domainNames: [`${DOMAIN}`, `www.${DOMAIN}`],
      certificate: props.certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    // ── CloudFront: Assets Distribution ────────────────────────────────────

    // Custom response headers policy that adds CORS headers for cross-origin fetch requests
    const corsHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'AssetsCorsPolicyUnconditional', {
      corsBehavior: {
        accessControlAllowOrigins: ['*'],
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowCredentials: false,
        originOverride: true,
      },
    })

    const assetsDist = new cloudfront.Distribution(this, 'AssetsDist', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        responseHeadersPolicy: corsHeadersPolicy,
      },
      domainNames: [`assets.${DOMAIN}`],
      certificate: props.certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    })

    // ── Cloudflare DNS: point domains at CloudFront ─────────────────────────
    // Custom resource Lambda upserts sokech.com, www.sokech.com, assets.sokech.com
    // as CNAMEs pointing at the two CloudFront distribution domains.

    const cfDnsFn = new lambda.Function(this, 'CfDnsFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cf-dns')),
      timeout: cdk.Duration.minutes(2),
    })

    cfDnsFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${CLOUDFLARE_SECRET_NAME}*`,
      ],
    }))

    const cfDnsProvider = new customResources.Provider(this, 'CfDnsProvider', {
      onEventHandler: cfDnsFn,
    })

    new cdk.CustomResource(this, 'CfDnsRecords', {
      serviceToken: cfDnsProvider.serviceToken,
      properties: {
        CloudflareSecretName: CLOUDFLARE_SECRET_NAME,
        DomainName: DOMAIN,
        SiteDomain: siteDist.distributionDomainName,
        AssetsDomain: assetsDist.distributionDomainName,
        // Changing distribution IDs or Version forces CloudFormation to re-invoke
        // the Lambda so DNS records stay in sync after any code or config change.
        SiteDistId: siteDist.distributionId,
        AssetsDistId: assetsDist.distributionId,
        Version: '2',
      },
    })

    // ── GitHub Actions: OIDC deploy role ───────────────────────────────────
    // Replaces long-lived IAM user access keys.
    // Trusts the specific repo only; grants minimal S3 + CloudFront permissions.

    // Import the existing OIDC provider — there can only be one per URL per account,
    // and it was already created by another stack (e.g. CloudClips).
    const githubOidc = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GithubOidcProvider',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    )

    const deployRole = new iam.Role(this, 'GithubActionsDeployRole', {
      roleName: 'sokech-github-actions-deploy',
      assumedBy: new iam.WebIdentityPrincipal(githubOidc.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:*`,
        },
      }),
    })

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:DeleteObject'],
      resources: [`${siteBucket.bucketArn}/*`],
    }))

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [siteBucket.bucketArn],
    }))

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${this.account}:distribution/${siteDist.distributionId}`],
    }))

    deployRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudformation:DescribeStacks'],
      resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/SokechSiteStack/*`],
    }))

    // ── Outputs ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'GitHub secret → AWS_ROLE_ARN',
    })

    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'GitHub secret → PORTFOLIO_S3_BUCKET',
    })

    new cdk.CfnOutput(this, 'SiteDistributionId', {
      value: siteDist.distributionId,
      description: 'GitHub secret → PORTFOLIO_CF_DIST_ID',
    })

    new cdk.CfnOutput(this, 'SiteDistDomain', {
      value: siteDist.distributionDomainName,
      description: 'Cloudflare CNAME target for sokech.com and www.sokech.com',
    })

    new cdk.CfnOutput(this, 'AssetsDistDomain', {
      value: assetsDist.distributionDomainName,
      description: 'Cloudflare CNAME target for assets.sokech.com',
    })
  }
}
