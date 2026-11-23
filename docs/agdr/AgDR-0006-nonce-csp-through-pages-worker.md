---
id: AgDR-0006
timestamp: 2026-11-23T11:00:00Z
agent: claude-code
model: claude-opus-5-5
session: f33ab127-7347-48d6-b3dd-4cd5ee89d4f1
trigger: code-review
status: executed
category: security
projects: [daftar1]
---

# Nonce-based CSP set by the Pages Worker on every HTML response

> In the context of #57, facing a static Next.js export whose inline RSC payload a hash-based policy cannot cover, I decided to route every path except `/_next/static/*` through the Pages Worker and have it set a fresh-nonce CSP on each HTML response, to remove `'unsafe-inline'` from `script-src`, accepting that HTML responses lose their cache validators and pay a Worker invocation.

This record was written on 2026-11-23, after the code landed in commit `cfd3a4e` on 2026-11-15. Rex asked for it in the review of PR #98.

## Context

- The live policy on daftar1.com allows `'unsafe-inline'` in `script-src`. One HTML-injection bug would then run script in a session that holds financial data.
- Next's static export inlines an RSC payload into every page. The payload differs per page and per build, so a hash list in `_headers` cannot cover it.
- Before this change `_routes.json` sent only `/*.txt` and `/api-proxy/*` to the Worker. HTML pages got their CSP from `_headers`.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Worker sets a per-response nonce on HTML (chosen) | Removes `'unsafe-inline'`. Works with the static export unchanged | Every HTML request invokes the Worker. HTML loses `ETag`, `Content-Length` and `Last-Modified` |
| Hashes in `_headers` | No Worker in the HTML path | Cannot cover the per-page RSC payload |
| Keep `'unsafe-inline'` | No change | Leaves the XSS impact open |
| Move off static export to server rendering | Native nonce support | Changes hosting and the whole build |

## Decision

- `_routes.json` includes `/*` and excludes only `/_next/static/*`, which is content-hashed.
- `_worker.js` sets `Content-Security-Policy` with a fresh nonce on each HTML response and adds that nonce to every inline script.
- It drops `ETag`, `Content-Length` and `Last-Modified` from those responses, because the body changes per response.
- A 304 passes through without a new policy, so the browser keeps the policy that matches its cached body.

## Consequences

- Every non-static request now runs the Worker. Workers usage on the Cloudflare plan grows with page views.
- HTML responses are not revalidated by `ETag`, so repeat visits download the HTML again. Static assets are unaffected.
- A new inline script must get its nonce from the Worker. A script added any other way is blocked, which is the intended failure.
- `apps/web/__tests__/session-worker-csp.test.ts` covers the header and body nonces, the 304 path and the routes.

## Artifacts

- Ticket: https://github.com/legend-h-99/daftar/issues/57
- PR: https://github.com/legend-h-99/daftar/pull/98
