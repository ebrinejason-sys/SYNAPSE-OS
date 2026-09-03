# Facility Domain Architecture (2026)

## Preferred OS model

```
*.synapseos.tech
        ↓
SYNAPSE OS Vercel project (synpase-os / prj_ST72DC6VkMfhon3M1yW2PL575mcd)
        ↓
apps/web middleware
        ↓
tenant slug lookup
        ↓
facility workspace (/os/[slug] …)
```

Reserved hostnames stay explicit:

- `synapseos.tech`
- `www.synapseos.tech`
- `admin.synapseos.tech`
- `app.synapseos.tech`

## Verified Vercel state (2026-09-03)

`synpase-os` domains currently include:

- synapseos.tech, www, admin, app, and Vercel aliases

**Missing:** `*.synapseos.tech` wildcard assignment.

Middleware already understands SYNAPSE subdomains, but wildcard **ingress is not proven** until:

1. DNS: `*.synapseos.tech` CNAME → `cname.vercel-dns.com` (or Vercel-required target)
2. Vercel project domain: add `*.synapseos.tech` to `synpase-os`
3. Synthetic proof: `domain-test.synapseos.tech` reaches OS and resolves tenant `domain-test`
4. Unknown tenant subdomain fails safely (no generic facility data)

Do not claim PASS for wildcard routing until those checks succeed.

## Pharmacy routing (chosen strategy)

Canonical:

`https://pharm.synapseos.tech/login?tenant=<tenant-slug>`

(tenant slug without required `pharm-` prefix in the query)

Compatibility:

- historical `pharm-<slug>.synapseos.tech` redirects remain in middleware where present
- do **not** mix `pharm-foo.synapseos.tech` + `/foo` + `foo.pharm.synapseos.tech` without an explicit compatibility map

## Custom domains

Tracked in `facility_domain_records` with states:

`NOT_REQUESTED | REQUESTED | PROVISIONING | DNS_PENDING | VERIFIED | ACTIVE | ERROR`

Never store Vercel bearer tokens. Platform Admin must show the real status — a DB hostname string alone is not “domain active”.

## Synapse Pharm project

Project: `synapse-pharm` / `prj_CHbxKSy0pee2nieRVvQ3Rhyw4cnh`

Observed issue: recent production deployments for main are **CANCELED**; last READY SHA lags GitHub main. `pharm.synapseos.tech` must be re-attached / redeployed so production SHA == intended main SHA and state = READY.
