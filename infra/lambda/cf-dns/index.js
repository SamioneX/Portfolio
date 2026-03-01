'use strict'

// Custom resource handler: creates/updates Cloudflare CNAME records pointing
// sokech.com, www.sokech.com, and assets.sokech.com at their respective
// CloudFront distribution domains. Runs on Create, Update, and Delete.
// All three records are fully managed — no manual DNS steps required.
//
// On Delete: removes all three CNAMEs from Cloudflare.

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')

const sm = new SecretsManagerClient({ region: 'us-east-1' })

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
  const checkRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${name}&type=CNAME`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const check = await checkRes.json()
  const record = { type: 'CNAME', name, content: value, ttl: 1, proxied: false }

  if (check.result && check.result.length > 0) {
    const existingId = check.result[0].id
    const putRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }
    )
    const putData = await putRes.json()

    if (!putData.success) {
      // Error 1053: record was auto-created by Cloudflare Registrar and can't be
      // edited in-place via the API. Delete it and recreate.
      if (putData.errors.some(e => e.code === 1053)) {
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        )
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
        console.log(`Replaced CNAME: ${name} → ${value}`)
      } else {
        throw new Error(`Cloudflare update failed: ${JSON.stringify(putData.errors)}`)
      }
    } else {
      console.log(`Updated CNAME: ${name} → ${value}`)
    }
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
    console.log(`Created CNAME: ${name} → ${value}`)
  }
}

async function deleteCname(token, zoneId, name) {
  const checkRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${name}&type=CNAME`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const check = await checkRes.json()
  if (!check.result || !check.result.length) return

  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${check.result[0].id}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  console.log(`Deleted CNAME: ${name}`)
}

exports.handler = async (event) => {
  console.log(JSON.stringify({ RequestType: event.RequestType, ResourceProperties: event.ResourceProperties }))

  const { RequestType, PhysicalResourceId, ResourceProperties } = event
  const { CloudflareSecretName, DomainName, SiteDomain, AssetsDomain } = ResourceProperties

  const token = await getToken(CloudflareSecretName)
  const zoneId = await getZoneId(token, DomainName)

  if (RequestType === 'Delete') {
    await deleteCname(token, zoneId, DomainName)
    await deleteCname(token, zoneId, `www.${DomainName}`)
    await deleteCname(token, zoneId, `assets.${DomainName}`)
    return { PhysicalResourceId }
  }

  // Create / Update — all three records are managed automatically.
  await upsertCname(token, zoneId, DomainName, SiteDomain)
  await upsertCname(token, zoneId, `www.${DomainName}`, SiteDomain)
  await upsertCname(token, zoneId, `assets.${DomainName}`, AssetsDomain)

  return {
    PhysicalResourceId: DomainName,
    Data: { SiteDomain, AssetsDomain },
  }
}
