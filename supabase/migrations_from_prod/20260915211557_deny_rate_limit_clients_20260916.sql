-- An explicit deny policy documents that only the trusted SECURITY DEFINER
-- function may touch the shared counter; it also keeps advisor output clear.
CREATE POLICY "AuthRateLimit_no_client_access" ON public."AuthRateLimit"
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
