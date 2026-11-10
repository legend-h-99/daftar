BEGIN;
ALTER TABLE public."ProductAnalyticsEvent"
  DROP CONSTRAINT "ProductAnalyticsEvent_event_check";
ALTER TABLE public."ProductAnalyticsEvent"
  ADD CONSTRAINT "ProductAnalyticsEvent_event_check" CHECK (event IN ('user_signed_up','user_signed_in','login_started','login_failed','onboarding_started','onboarding_completed','product_created','invoice_created','expense_added','purchase_recorded','session_started','landing_viewed','cta_clicked','page_viewed','workflow_started','workflow_failed', 'first_expense_prompt_viewed', 'first_expense_prompt_clicked', 'first_expense_prompt_skipped', 'first_expense_completed'));
COMMIT;
