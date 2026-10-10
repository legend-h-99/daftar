# Customer behavior — 10 October 2026

Decision: identify whether prospective home-business owners fail to start sign-in, finish setup, or save a first useful record. A new account is not retention or evidence of a genuine business.

Baseline measurement readiness: 41/100 (decision alignment 20/25, event clarity 12/20, accuracy 0/20, conversion definition 4/15, attribution 0/10, governance 5/10). Existing disabled PostHog instrumentation and missing Google new-account distinction cannot support drop-off conclusions. Remediation: first-party collection, strict privacy validation, event validation, then collect a new cohort before interpreting results. This score is diagnostic judgment, not a measured business KPI.

| Event | Trigger | Safe properties | Decision |
| --- | --- | --- | --- |
| page_viewed / landing_viewed | Route exposure / landing mount | Normalized route, anonymous source | Where visitors arrive |
| login_started / login_failed | Google credential callback / failure | method, HTTP status | Identify sign-in failures; opening the Google chooser alone is not captured |
| user_signed_up | API confirms a newly created Google account | method | Distinguish new accounts from returning logins |
| user_signed_in | Successful sign-in | method, has_business | Access to app |
| onboarding_started / onboarding_completed | First setup step submitted / business saved | vat_enabled | Setup completion |
| workflow_started / workflow_failed | Save attempt / validation or API failure | workflow, HTTP status | Find save friction |
| product_created / invoice_created / expense_added / purchase_recorded | Successful save only | Bounded item counts | First useful action |
| session_started | First authenticated app load in anonymous session | days_since_last | Returning device signal |

Funnel: anonymous device visits landing/login → starts sign-in → new Google account → business setup → first saved product/invoice/expense/purchase. Browser action timestamps (bounded within 15 minutes of receipt; otherwise receipt time) preserve event ordering across concurrent requests. Wrong device clocks or lost requests can still undercount the funnel. Steps must follow timestamps in this order within the chosen 7/30-day cohort. Counts are devices, not verified people or businesses. Clearing storage, changing browsers/devices, founder visits and automation affect counts. Public browser telemetry can be spoofed; accounting records remain the source of truth for actual operations. Recent cohorts are incomplete and differences are “not reached yet”, not confirmed abandonment.

No account identifiers, names, emails, amounts, query strings, typed text, or full referrers. Admin and unknown/dynamic paths are excluded. Cookies omitted on telemetry requests. Do Not Track, Global Privacy Control, and local opt-out stop collection; opt-out clears measurement identifiers. Events are stored in the existing Supabase project, accessible only to service_role and through the existing authenticated admin route. Server rejects unrecognized properties and event types, limits event size/rate, timestamps events, deduplicates event IDs, and prunes events older than 30 days on ingestion/summary access. Expired events can physically remain during inactivity until the next pruning trigger; backups have separate existing retention.

Source attribution: utm_source=x, instagram, tiktok, whatsapp. Only these categories are stored, not arbitrary UTM text. Recognized referral hosts are fallback; “direct” includes unknown source. One device can appear under several sources. No session replay or advertising profiles.

Destinations: POST /api-proxy/analytics/events → record_product_event; GET /admin/analytics?days=7|30 → private summary. Website defaults to measurement enabled only on daftar1.com, www.daftar1.com and daftar-ead.pages.dev; preview/local/demo hosts are excluded unless explicitly enabled. Emergency off switches: NEXT_PUBLIC_ANALYTICS_ENABLED=false (rebuild), ANALYTICS_ENABLED=false (server secret). No PostHog key required.

Admin view: /admin → سلوك العميل. Owner maintains instrumentation and reviews source quality before acting. Tests cover input/privacy validation, opt-out, browser privacy signals, session duplication, transport failure, ordered funnel, event deduplication, tenant-neutral anonymous counts and database permissions. Cross-device identity is intentionally unsupported.
