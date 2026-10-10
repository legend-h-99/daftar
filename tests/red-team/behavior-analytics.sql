\set ON_ERROR_STOP on
-- Disposable database only: all events are synthetic and timestamped explicitly.
\ir ../../supabase/migrations/20261010120000_product_behavior_analytics.sql
SELECT record_product_event('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','page_viewed','/login','x','{}',now());
SELECT record_product_event('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','page_viewed','/login','x','{}',now());
INSERT INTO "ProductAnalyticsEvent" (id,"deviceId","sessionId",event,path,source,properties,"occurredAt","createdAt") SELECT ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',e,'/login','x','{}',now()+n*interval '1 second',now()+n*interval '1 second' FROM (VALUES (2,'login_started'),(3,'user_signed_up'),(4,'onboarding_completed'),(5,'product_created')) AS fixtures(n,e);
-- A second device saves before onboarding; do not fabricate ordered activation.
INSERT INTO "ProductAnalyticsEvent" (id,"deviceId","sessionId",event,path,source,properties,"occurredAt","createdAt") SELECT ('10000000-0000-4000-8000-'||lpad((n+10)::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002',e,'/login','direct','{}',now()+n*interval '1 second',now()+n*interval '1 second' FROM (VALUES (1,'page_viewed'),(2,'login_started'),(3,'user_signed_up'),(4,'expense_added'),(5,'onboarding_completed')) AS fixtures(n,e);
INSERT INTO "ProductAnalyticsEvent" VALUES ('10000000-0000-4000-8000-000000000020','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','invoice_created','/invoices/new','x','{}',now()-interval '1 day',now()-interval '1 day');
INSERT INTO "ProductAnalyticsEvent" VALUES ('10000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000099','30000000-0000-4000-8000-000000000099','page_viewed','/login','direct','{}',now()-interval '31 days',now()-interval '31 days');
DO $$ DECLARE r jsonb; BEGIN
 r:=product_analytics_summary(7);
 IF r->'funnel' <> '{"visited":2,"started":2,"signedUp":2,"onboarded":2,"activated":1}'::jsonb THEN RAISE EXCEPTION 'wrong ordered funnel: %',r; END IF;
 IF (r->>'devices')::int<>2 OR (r->>'repeatDevices')::int<>1 THEN RAISE EXCEPTION 'wrong distinct counts: %',r; END IF;
 IF (SELECT count(*) FROM "ProductAnalyticsEvent") <> 11 THEN RAISE EXCEPTION 'duplicate or expired events remain'; END IF;
 IF has_table_privilege('anon','public."ProductAnalyticsEvent"','SELECT') OR has_table_privilege('authenticated','public."ProductAnalyticsEvent"','SELECT') THEN RAISE EXCEPTION 'public table access'; END IF;
 IF has_function_privilege('anon','public.record_product_event(uuid,uuid,uuid,text,text,text,jsonb,timestamptz)','EXECUTE') OR has_function_privilege('authenticated','public.product_analytics_summary(integer)','EXECUTE') THEN RAISE EXCEPTION 'public function access'; END IF;
 BEGIN PERFORM product_analytics_summary(999); RAISE EXCEPTION 'invalid period accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='invalid period accepted' THEN RAISE; END IF; END;
END $$;
