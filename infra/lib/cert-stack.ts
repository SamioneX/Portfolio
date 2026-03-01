import * as path from 'path'
import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as customResources from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'
import { DOMAIN, CLOUDFLARE_SECRET_NAME } from './constants'

export class CertStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // ── Cert Validator Lambda ──────────────────────────────────────────────
    // The Lambda owns the full cert lifecycle:
    //   Create  → acm.RequestCertificate → add Cloudflare CNAMEs → poll until ISSUED
    //   Update  → no-op (reuses existing cert ARN stored in PhysicalResourceId)
    //   Delete  → acm.DeleteCertificate
    //
    // By NOT using CfnCertificate (AWS::CertificateManager::Certificate),
    // we avoid the CloudFormation deadlock where CFn blocks on cert issuance
    // before the Lambda custom resource can add the DNS validation records.
    const validatorFn = new lambda.Function(this, 'CertValidatorFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cert-validator')),
      timeout: cdk.Duration.minutes(10),
    })

    validatorFn.addToRolePolicy(new iam.PolicyStatement({
      // Can't scope to a specific cert ARN before the cert is requested.
      actions: ['acm:RequestCertificate', 'acm:DescribeCertificate', 'acm:DeleteCertificate'],
      resources: ['*'],
    }))

    validatorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [
        `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${CLOUDFLARE_SECRET_NAME}*`,
      ],
    }))

    const provider = new customResources.Provider(this, 'CertValidatorProvider', {
      onEventHandler: validatorFn,
    })

    const validation = new cdk.CustomResource(this, 'CertValidation', {
      serviceToken: provider.serviceToken,
      properties: {
        CloudflareSecretName: CLOUDFLARE_SECRET_NAME,
        DomainName: DOMAIN,
      },
    })

    // The Lambda returns the cert ARN in Data.CertificateArn.
    const certArn = validation.getAttString('CertificateArn')
    this.certificate = acm.Certificate.fromCertificateArn(this, 'ImportedCert', certArn)

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: certArn,
      description: 'ACM certificate ARN',
    })
  }
}
