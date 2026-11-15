BEGIN;
CREATE TABLE public."ProductAnalyticsEvent" (
  id uuid PRIMARY KEY,
  "deviceId" uuid NOT NULL,
  "sessionId" uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('user_signed_up','user_signed_in','login_started','login_failed','onboarding_started','onboarding_completed','product_created','invoice_created','expense_added','purchase_recorded','session_started','landing_viewed','cta_clicked','page_viewed','workflow_started','workflow_failed')),
  path text NOT NULL CHECK (path IN ('/','/landing','/login','/onboarding','/dashboard','/products','/products/new','/products/edit/view','/inventory','/expenses','/invoices','/invoices/list','/invoices/new','/invoices/detail/view','/purchases','/purchases/new','/purchases/scan','/reports','/plans','/privacy','/forgot-password','/reset-password','/verify-email','/register','/otp','/offline')),
  source text NOT NULL CHECK (source IN ('x','instagram','tiktok','whatsapp','direct','other')),
  properties jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(properties)='object' AND octet_length(properties::text)<=1024),
  "occurredAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX product_analytics_time_idx ON public."ProductAnalyticsEvent" ("createdAt");
CREATE INDEX product_analytics_device_time_idx ON public."ProductAnalyticsEvent" ("deviceId", "createdAt");
ALTER TABLE public."ProductAnalyticsEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."ProductAnalyticsEvent" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public."ProductAnalyticsEvent" TO service_role;
CREATE FUNCTION public.record_product_event(p_id uuid,p_device_id uuid,p_session_id uuid,p_event text,p_path text,p_source text,p_properties jsonb,p_occurred_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  -- Best-effort pruning runs on ingestion and when opening the admin summary.
  DELETE FROM "ProductAnalyticsEvent" WHERE "createdAt" < now()-interval '30 days';
  INSERT INTO "ProductAnalyticsEvent" (id,"deviceId","sessionId",event,path,source,properties,"occurredAt")
  VALUES (p_id,p_device_id,p_session_id,p_event,p_path,p_source,p_properties,p_occurred_at) ON CONFLICT (id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_product_event(uuid,uuid,uuid,text,text,text,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_product_event(uuid,uuid,uuid,text,text,text,jsonb,timestamptz) TO service_role;
CREATE FUNCTION public.product_analytics_summary(p_days integer DEFAULT 7)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF p_days NOT IN (7,30) THEN RAISE EXCEPTION 'Invalid time range'; END IF;
 DELETE FROM "ProductAnalyticsEvent" WHERE "createdAt" < now()-interval '30 days';
 WITH rows AS (SELECT * FROM "ProductAnalyticsEvent" WHERE "createdAt">=now()-make_interval(days=>p_days)),
 visits AS (SELECT "deviceId",min("occurredAt") AS visited FROM rows WHERE event='landing_viewed' OR (event='page_viewed' AND path IN ('/','/landing','/login')) GROUP BY "deviceId"),
 journey AS (
  SELECT v.*,l.started,s.signed_up,o.onboarded,a.activated FROM visits v
  LEFT JOIN LATERAL (SELECT min("occurredAt") started FROM rows WHERE "deviceId"=v."deviceId" AND event='login_started' AND "occurredAt">=v.visited) l ON true
  LEFT JOIN LATERAL (SELECT min("occurredAt") signed_up FROM rows WHERE "deviceId"=v."deviceId" AND event='user_signed_up' AND "occurredAt">=l.started) s ON true
  LEFT JOIN LATERAL (SELECT min("occurredAt") onboarded FROM rows WHERE "deviceId"=v."deviceId" AND event='onboarding_completed' AND "occurredAt">=s.signed_up) o ON true
  LEFT JOIN LATERAL (SELECT min("occurredAt") activated FROM rows WHERE "deviceId"=v."deviceId" AND event IN ('product_created','invoice_created','expense_added','purchase_recorded') AND "occurredAt">=o.onboarded) a ON true
 ), activity AS (SELECT "deviceId",count(DISTINCT ("occurredAt" AT TIME ZONE 'Asia/Riyadh')::date) days FROM rows WHERE event IN ('product_created','invoice_created','expense_added','purchase_recorded') GROUP BY "deviceId")
 SELECT jsonb_build_object(
  'days',p_days,'startedAt',(SELECT min("createdAt") FROM "ProductAnalyticsEvent"),'devices',(SELECT count(DISTINCT "deviceId") FROM rows),'sessions',(SELECT count(DISTINCT "sessionId") FROM rows),
  'funnel',(SELECT jsonb_build_object('visited',count(*),'started',count(started),'signedUp',count(signed_up),'onboarded',count(onboarded),'activated',count(activated)) FROM journey),
  'activeDevices',(SELECT count(*) FROM activity),'repeatDevices',(SELECT count(*) FROM activity WHERE days>=2),
  'events',(SELECT coalesce(jsonb_agg(x ORDER BY x.count DESC),'[]') FROM (SELECT event,count(*) count,count(DISTINCT "deviceId") devices FROM rows GROUP BY event) x),
  'pages',(SELECT coalesce(jsonb_agg(x ORDER BY x.views DESC),'[]') FROM (SELECT path,count(*) views FROM rows WHERE event='page_viewed' GROUP BY path) x),
  'sources',(SELECT coalesce(jsonb_agg(x ORDER BY x.devices DESC),'[]') FROM (SELECT source,count(DISTINCT "deviceId") devices FROM rows WHERE event='landing_viewed' OR (event='page_viewed' AND path IN ('/','/landing','/login')) GROUP BY source) x),
  'failures',(SELECT coalesce(jsonb_agg(x ORDER BY x.count DESC),'[]') FROM (SELECT coalesce(properties->>'workflow','login') workflow,coalesce(properties->>'status','unknown') status,count(*) count FROM rows WHERE event IN ('workflow_failed','login_failed') GROUP BY 1,2) x)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.product_analytics_summary(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_analytics_summary(integer) TO service_role;
COMMIT;
