'use strict'

// Custom resource handler — owns the full ACM certificate lifecycle.
//
// Create:  RequestCertificate (DNS validation) → add Cloudflare CNAMEs → poll until ISSUED
// Update:  no-op (cert ARN is stable in PhysicalResourceId)
// Delete:  DeleteCertificate + ignore ResourceNotFoundException
//
// AWS SDK v3 and fetch() are both built into the Node.js 20 runtime.

const {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  DeleteCertificateCommand,
} = require('@aws-sdk/client-acm')
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')

const acm = new ACMClient({ region: 'us-east-1' })
const sm  = new SecretsManagerClient({ region: 'us-east-1' })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getToken(secretName) {
  const res = await sm.send(new GetSecretValueCommand({ SecretId: secretName }))
  return res.SecretString
}

async function getZoneId(token, domain) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!data.success || !data.result.length) {
    throw new Error(`Cloudflare zone not found for: ${domain}`)
  }
  return data.result[0].id
}

async function upsertCname(token, zoneId, name, value) {
  // Remove trailing dots that ACM includes in record names/values.
  const n = name.replace(/\.$/, '')
  const v = value.replace(/\.$/, '')

  const checkRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${n}&type=CNAME`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const check = await checkRes.json()
  const record = { type: 'CNAME', name: n, content: v, ttl: 1, proxied: false }

  if (check.result && check.result.length > 0) {
    const putRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${check.result[0].id}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }
    )
    const putData = await putRes.json()
    if (!putData.success) throw new Error(`Cloudflare update failed: ${JSON.stringify(putData.errors)}`)
    console.log(`Updated CNAME: ${n} → ${v}`)
  } else {
    const postRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }
    )
    const postData = await postRes.json()
    if (!postData.success) throw new Error(`Cloudflare create failed: ${JSON.stringify(postData.errors)}`)
    console.log(`Created CNAME: ${n} → ${v}`)
  }
}

// Validation records appear a few seconds after RequestCertificate.
async function waitForValidationRecords(certArn, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await acm.send(new DescribeCertificateCommand({ CertificateArn: certArn }))
    const records = (res.Certificate.DomainValidationOptions ?? [])
      .filter(o => o.ResourceRecord)
      .map(o => o.ResourceRecord)
    if (records.length > 0) return records
    console.log(`Waiting for ACM validation records... (${i + 1}/${maxAttempts})`)
    await sleep(4000)
  }
  throw new Error('Timed out waiting for ACM validation records')
}

// Poll until ISSUED or FAILED (up to ~10 min at 15 s intervals).
async function waitForIssuance(certArn, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await acm.send(new DescribeCertificateCommand({ CertificateArn: certArn }))
    const status = res.Certificate.Status
    console.log(`Cert status: ${status} (${i + 1}/${maxAttempts})`)
    if (status === 'ISSUED') return
    if (status === 'FAILED') {
      throw new Error(`Certificate issuance failed: ${res.Certificate.FailureReason}`)
    }
    await sleep(15000)
  }
  throw new Error('Cert not issued within the allotted time')
}

exports.handler = async (event) => {
  console.log(JSON.stringify({ RequestType: event.RequestType, ResourceProperties: event.ResourceProperties }))

  const { RequestType, PhysicalResourceId, ResourceProperties } = event
  const { CloudflareSecretName, DomainName } = ResourceProperties

  // ── Delete ──────────────────────────────────────────────────────────────
  if (RequestType === 'Delete') {
    if (PhysicalResourceId && PhysicalResourceId.startsWith('arn:')) {
      try {
        await acm.send(new DeleteCertificateCommand({ CertificateArn: PhysicalResourceId }))
        console.log('Deleted certificate:', PhysicalResourceId)
      } catch (e) {
        // ResourceNotFoundException means it was already deleted — safe to ignore.
        if (e.name !== 'ResourceNotFoundException') throw e
        console.log('Certificate already deleted:', PhysicalResourceId)
      }
    }
    return { PhysicalResourceId }
  }

  // ── Update ───────────────────────────────────────────────────────────────
  // No changes needed — the cert ARN is stable and ACM handles renewal.
  if (RequestType === 'Update') {
    return { PhysicalResourceId, Data: { CertificateArn: PhysicalResourceId } }
  }

  // ── Create ───────────────────────────────────────────────────────────────
  const res = await acm.send(new RequestCertificateCommand({
    DomainName: DomainName,
    SubjectAlternativeNames: [`*.${DomainName}`],
    ValidationMethod: 'DNS',
  }))
  const certArn = res.CertificateArn
  console.log('Requested certificate:', certArn)

  const token = await getToken(CloudflareSecretName)
  const zoneId = await getZoneId(token, DomainName)

  const validationRecords = await waitForValidationRecords(certArn)
  console.log(`Got ${validationRecords.length} validation record(s)`)

  // Apex + wildcard typically share one validation record — deduplicate.
  const seen = new Set()
  for (const record of validationRecords) {
    if (seen.has(record.Name)) continue
    seen.add(record.Name)
    await upsertCname(token, zoneId, record.Name, record.Value)
  }

  await waitForIssuance(certArn)
  console.log('Certificate issued:', certArn)

  return {
    PhysicalResourceId: certArn,
    Data: { CertificateArn: certArn },
  }
}
