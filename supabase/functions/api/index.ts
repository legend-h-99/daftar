import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2'
import * as bcrypt from 'https://esm.sh/bcryptjs@3.0.3'

const CORS = {
  'access-control-allow-origin': 'https://daftar-ead.pages.dev',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info, idempotency-key',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  // Chrome caps this at 2 hours; without it every authorized call pays a preflight.
  'access-control-max-age': '7200',
}

const ALLOWED_ORIGINS = new Set([
  'https://daftar-ead.pages.dev',
  'https://daftar1.com',
  'https://www.daftar1.com',
])

function corsFor(req: Request): Record<string, string> {
  const headers = { ...CORS }
  const origin = req.headers.get('Origin')
  if (origin && ALLOWED_ORIGINS.has(origin)) headers['access-control-allow-origin'] = origin
  return headers
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Prefer a separate signing secret. The service key is a private, deployment-stable
// fallback until JWT_SECRET is provisioned; never use a source-code literal.
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? SERVICE_KEY
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '269103980010-fbvbr60h67qh60j8cbib2a9agle2087n.apps.googleusercontent.com'
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_DAILY_SEND_CAP = Number.parseInt(Deno.env.get('EMAIL_DAILY_SEND_CAP') ?? '100', 10)
const SMS_DAILY_SEND_CAP = Number.parseInt(Deno.env.get('SMS_DAILY_SEND_CAP') ?? '100', 10)
// Phone sign-in stays off unless it is deliberately enabled in the Edge Function.
// This server-side gate also protects native clients that do not use the web flag.
const PHONE_LOGIN_ENABLED = Deno.env.get('PHONE_LOGIN_ENABLED') === 'true'
const DEMO_AUTH_ENABLED = Deno.env.get('DEMO_AUTH_ENABLED') === 'true'

const DEMO_STORES: Record<string, { name: string; city: string }> = {
  '+966500000001': { name: 'مطبخ أم سلطان', city: 'الرياض' },
  '+966500000002': { name: 'مخبزة بيت الخبز', city: 'جدة' },
  '+966500000003': { name: 'حلويات أم يوسف', city: 'مكة' },
  '+966500000004': { name: 'ورشة العود والبخور', city: 'الدمام' },
  '+966500000005': { name: 'خياطة الأناقة', city: 'الرياض' },
  '+966500000006': { name: 'صابون الطبيعة', city: 'بريدة' },
  '+966500000007': { name: 'شموع ولمسات', city: 'الخبر' },
  '+966500000008': { name: "بُنّ الديار", city: 'الرياض' },
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('966')) return `+${digits}`
  if (digits.startsWith('0')) return `+966${digits.slice(1)}`
  return `+966${digits}`
}

// Right after a cold start the API gateway has answered 401 to some of the
// first concurrent calls, although every call carries the same service key.
// A 401 means the request was rejected before it ran, so one retry is safe
// even for writes; any other status is returned as is.
async function gatewayRetryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (response.status !== 401) return response
  console.warn('Database gateway answered 401; retrying once')
  return fetch(input, init)
}

let dbClient: ReturnType<typeof createClient> | null = null
function db() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Database configuration missing')
  dbClient ??= createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: { fetch: gatewayRetryFetch },
  })
  return dbClient
}

async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const enc = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  if (!JWT_SECRET) throw new Error('JWT configuration missing')
  const claims = enc(JSON.stringify({ ...payload, jti: crypto.randomUUID(), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }))
  const data = `${header}.${claims}`
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sigB64}`
}

async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !JWT_SECRET) return null
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const pad = (s: string) => s + '='.repeat((4 - s.length % 4) % 4)
    const sig = Uint8Array.from(atob(pad(parts[2].replace(/-/g, '+').replace(/_/g, '/'))), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
    if (!valid) return null
    const p = JSON.parse(atob(pad(parts[1].replace(/-/g, '+').replace(/_/g, '/'))))
    if (typeof p.exp !== 'number' || p.exp <= Math.floor(Date.now() / 1000) ||
      typeof p.sub !== 'string' || typeof p.jti !== 'string' || !p.jti) return null
    return p
  } catch { return null }
}

// Resolves the caller, or a Response to send instead: 401 for a bad or revoked
// token, 503 when the lookup itself failed (the web app logs out on 401, so a
// database blip must not look like one), 429 for the per-account cap.
async function getUser(req: Request): Promise<Record<string, unknown> | Response> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return err('Unauthorized', 401)
  const claims = await verifyJwt(auth.slice(7))
  if (!claims) return err('Unauthorized', 401)
  const supabase = db()
  // One parallel round trip: revocation, account and the per-account rate limit.
  const [blacklist, account, limited] = await Promise.all([
    supabase.from('TokenBlacklist').select('jti').eq('jti', claims.jti as string).maybeSingle(),
    supabase.from('User').select('id,phone,email,googleId,businessId').eq('id', claims.sub).maybeSingle(),
    rateLimit(req, 'api-account', claims.sub, 100, { includeIp: false }),
  ])
  if (blacklist.error || account.error) return err('Service temporarily unavailable', 503)
  if (blacklist.data || !account.data) return err('Unauthorized', 401)
  if (limited) return limited
  const row = account.data
  return { ...claims, phone: row.phone, email: row.email, googleId: row.googleId, businessId: row.businessId }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
// `code` lets the web app show a localized message instead of this English text.
function err(msg: string, status = 400, code?: string, extra: Record<string, unknown> = {}) {
  return json({ message: msg, statusCode: status, ...(code ? { code } : {}), ...extra }, status)
}

async function rateLimit(
  req: Request, action: string, identifier: unknown, limit: number, { includeIp = true } = {},
): Promise<Response | null> {
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const identity = typeof identifier === 'string' ? identifier.trim().toLowerCase() : ''
  const keys = includeIp ? [`${action}:ip:${ip}`] : []
  if (identity) keys.push(`${action}:account:${identity}`)
  const outcomes = await Promise.all(keys.map(async key => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
    const hashed = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
    return db().rpc('consume_auth_rate_limit', { p_key: hashed, p_limit: limit, p_window_seconds: 60 })
  }))
  if (outcomes.some(o => o.error)) return err('Authentication temporarily unavailable', 503)
  if (outcomes.some(o => o.data !== true)) return err('Too many requests; try again shortly', 429, 'RATE_LIMITED')
  return null
}

// Saudi VAT registration numbers are 15 digits that start and end with 3.
const VAT_NUMBER_PATTERN = /^3\d{13}3$/

function invalidBusinessName(value: unknown): boolean {
  return typeof value !== 'string' || !value.trim() || value.trim().length > 100
}

function invalidVatNumber(value: unknown): boolean {
  return value != null && (typeof value !== 'string' || !VAT_NUMBER_PATTERN.test(value))
}

async function reserveDailyEmailSend(): Promise<boolean> {
  if (!Number.isInteger(EMAIL_DAILY_SEND_CAP) || EMAIL_DAILY_SEND_CAP < 1) return false
  const { data, error } = await db().rpc('consume_external_usage_budget', {
    p_key: 'emails', p_daily_limit: EMAIL_DAILY_SEND_CAP,
  })
  return !error && data === true
}

async function reserveDailySmsSend(): Promise<boolean> {
  if (!Number.isInteger(SMS_DAILY_SEND_CAP) || SMS_DAILY_SEND_CAP < 1) return false
  const { data, error } = await db().rpc('consume_external_usage_budget', {
    p_key: 'sms', p_daily_limit: SMS_DAILY_SEND_CAP,
  })
  return !error && data === true
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

function normalizePath(rawPath: string): string {
  return rawPath
    .replace(/^\/functions\/v1\/(?:api-candidate|api)(?=\/|$)/, '')
    .replace(/^\/(?:api-candidate|api)(?=\/|$)/, '')
    || '/'
}

// Saudi Arabia is UTC+3 all year (no daylight saving).
const RIYADH_OFFSET_MS = 3 * 3600 * 1000

// A calendar month in Riyadh: `start`/`end` bound stored UTC timestamps
// (createdAt); `startDate`/`endDate` bound business dates (expense/purchase date).
function monthRange(month: string | null): { start: string; end: string; startDate: string; endDate: string } | null {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const [y, m] = month.split('-').map(Number)
  const first = Date.UTC(y, m - 1, 1)
  const next = Date.UTC(y, m, 1)
  return {
    start: new Date(first - RIYADH_OFFSET_MS).toISOString(),
    end: new Date(next - RIYADH_OFFSET_MS).toISOString(),
    startDate: new Date(first).toISOString().slice(0, 10),
    endDate: new Date(next).toISOString().slice(0, 10),
  }
}

function currentRiyadhMonth(): string {
  return new Date(Date.now() + RIYADH_OFFSET_MS).toISOString().slice(0, 7)
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

async function authGoogle(credential: string) {
  if (!GOOGLE_CLIENT_ID) return err('Google login is not configured', 503)
  const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
  if (!tokenRes.ok) return err('Invalid Google token', 401)
  const payload = await tokenRes.json()
  if (payload.aud !== GOOGLE_CLIENT_ID || payload.email_verified !== 'true' && payload.email_verified !== true) return err('Invalid Google token', 401)
  if (!payload.sub || !payload.email) return err('Invalid Google token', 401)

  const googleId = payload.sub as string
  const email = payload.email as string
  const name = (payload.name ?? payload.given_name ?? '') as string
  const supabase = db()

  let { data: user } = await supabase.from('User').select('*').eq('googleId', googleId).maybeSingle()
  if (!user) {
    const { data: byEmail } = await supabase.from('User').select('*').eq('email', email).maybeSingle()
    if (byEmail) {
      await supabase.from('User').update({ googleId, name: byEmail.name ?? name }).eq('id', byEmail.id)
      user = { ...byEmail, googleId }
    } else {
      const userId = newId('user')
      const { data: created, error: insertErr } = await supabase.from('User').insert({ id: userId, email, googleId, name }).select().single()
      if (insertErr) return err('Could not create account', 500)
      user = created
    }
  }
  if (!user) return err('Could not create user', 500)

  const accessToken = await signJwt({ sub: user.id, email, googleId, businessId: user.businessId })
  return json({ accessToken, user: { id: user.id, email, name: user.name ?? name, businessId: user.businessId }, hasBusiness: !!user.businessId })
}

async function authDemoLogin(phone: string) {
  if (!DEMO_AUTH_ENABLED) return err('Demo login is disabled', 404)
  const normalized = normalizePhone(phone)
  const store = DEMO_STORES[normalized]
  if (!store) return err('Unknown demo account')
  const supabase = db()
  const bizId = `biz_demo_${normalized.replace(/\+/g, '')}`
  const userId = `user_demo_${normalized.replace(/\+/g, '')}`
  await supabase.from('Business').upsert({ id: bizId, ownerPhone: normalized, name: store.name, city: store.city, vatEnabled: true, vatNumber: '300000000000003' }, { onConflict: 'id' })
  await supabase.from('User').upsert({ id: userId, phone: normalized, businessId: bizId }, { onConflict: 'id' })
  const accessToken = await signJwt({ sub: userId, phone: normalized, businessId: bizId })
  return json({ accessToken, user: { id: userId, phone: normalized, businessId: bizId }, hasBusiness: true, business: { id: bizId, ...store, vatEnabled: true } })
}

async function authOtpRequest(phoneInput: unknown) {
  if (typeof phoneInput !== 'string') return err('Enter a valid Saudi mobile number', 400)
  const phone = normalizePhone(phoneInput)
  if (!/^\+9665\d{8}$/.test(phone)) return err('Enter a valid Saudi mobile number', 400)
  if (!await reserveDailySmsSend()) return err('Phone verification is temporarily unavailable', 503)

  const { error } = await db().auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  })
  if (error) {
    // Keep provider details and phone numbers out of the public response/logs.
    return err('Phone verification is temporarily unavailable', 503)
  }
  return json({ sent: true })
}

async function authOtpVerify(phoneInput: unknown, code: unknown) {
  if (typeof phoneInput !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return err('Invalid or expired verification code', 400)
  }
  const normalized = normalizePhone(phoneInput)
  if (!/^\+9665\d{8}$/.test(normalized)) return err('Invalid or expired verification code', 400)
  const supabase = db()
  const { data: verification, error: verificationError } = await supabase.auth.verifyOtp({
    phone: normalized,
    token: code,
    type: 'sms',
  })
  if (verificationError || !verification.user) return err('Invalid or expired verification code', 401)
  let { data: user } = await supabase.from('User').select('*').eq('phone', normalized).maybeSingle()
  if (!user) {
    const { data: created, error } = await supabase
      .from('User').insert({ id: newId('user'), phone: normalized }).select('*').single()
    if (error) {
      // A concurrent first sign-in may have won the unique-phone insert.
      const { data: raced } = await supabase.from('User').select('*').eq('phone', normalized).maybeSingle()
      if (!raced) return err('Could not create account', 500)
      user = raced
    } else {
      user = created
    }
  }
  const accessToken = await signJwt({ sub: user.id, phone: normalized, businessId: user.businessId })
  return json({ accessToken, user: { id: user.id, phone: normalized, businessId: user.businessId }, hasBusiness: !!user.businessId })
}

async function authMe(userId: string) {
  const { data, error } = await db().from('User').select('id,phone,email,name,businessId,Business(*)').eq('id', userId).single()
  if (error && error.code !== 'PGRST116') return err('Service temporarily unavailable', 503)
  if (!data) return err('User not found', 404)
  return json({ ...data, business: data.Business, user: { id: data.id, phone: data.phone, email: data.email, businessId: data.businessId } })
}

function validEmailInput(email: unknown, password: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    typeof password === 'string' && password.length >= 8 && password.length <= 128
}

async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  if (!await reserveDailyEmailSend()) return false
  const link = `https://daftar1.com/verify-email?token=${encodeURIComponent(token)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'Daftar <onboarding@resend.dev>',
      to: [email],
      subject: 'Confirm your Daftar email address',
      html: `<p>Confirm your Daftar account:</p><p><a href="${link}">Confirm email</a></p><p>This link expires in 24 hours.</p>`,
    }),
  })
  return response.ok
}

async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  if (!await reserveDailyEmailSend()) return false
  const link = `https://daftar1.com/reset-password?token=${encodeURIComponent(token)}`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'Daftar <onboarding@resend.dev>',
      to: [email],
      subject: 'Reset your Daftar password',
      html: `<p>We received a request to reset your Daftar password.</p><p><a href="${link}">Choose a new password</a></p><p>This link expires in 1 hour.</p>`,
    }),
  })
  return response.ok
}

async function authEmailRegister(body: Record<string, unknown>) {
  if (!RESEND_API_KEY) return err('Email registration is temporarily unavailable', 503)
  if (!validEmailInput(body.email, body.password)) return err('Invalid email or password', 400)
  const email = body.email.trim().toLowerCase()
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : null
  const supabase = db()
  const { data: existing } = await supabase.from('User').select('id,emailVerified').eq('email', email).maybeSingle()
  if (existing?.emailVerified) return err('Email already registered', 400)
  const passwordHash = await bcrypt.hash(body.password as string, 12)
  let userId: string
  if (existing) {
    userId = existing.id
    const { error } = await supabase.from('User').update({ passwordHash, name }).eq('id', userId)
    if (error) return err('Could not register', 500)
  } else {
    userId = newId('user')
    const { error } = await supabase.from('User').insert({ id: userId, email, passwordHash, name, emailVerified: false })
    if (error) return err('Could not register', 500)
  }
  await supabase.from('EmailVerification').update({ consumed: true }).eq('userId', userId).eq('consumed', false)
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  const { error } = await supabase.from('EmailVerification').insert({
    id: newId('verification'), userId, token,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  })
  if (error) return err('Could not register', 500)
  if (!await sendVerificationEmail(email, token)) return err('Could not send verification email', 503)
  return json({ sent: true })
}

// A real bcrypt hash (cost 12) of a random string, compared when the email has
// no password so unknown and known addresses take the same time to reject.
const DUMMY_PASSWORD_HASH = '$2b$12$rzlddSFCiO/4vBLQWOZ5SeFd/MUyeKLG5ClUaB1Uav8RBbTaRdM0q'

async function authEmailLogin(body: Record<string, unknown>) {
  const invalid = () => err('Invalid credentials', 401, 'INVALID_CREDENTIALS')
  if (typeof body.email !== 'string' || typeof body.password !== 'string') return invalid()
  const supabase = db()
  const email = body.email.trim().toLowerCase()
  const { data: user, error } = await supabase.from('User').select('id,email,phone,name,businessId,passwordHash,emailVerified').eq('email', email).maybeSingle()
  if (error) return err('Service temporarily unavailable', 503)
  const passwordMatches = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH) && Boolean(user?.passwordHash)
  if (!passwordMatches) return invalid()
  if (!user.emailVerified) return err('Please verify your email address first', 403, 'EMAIL_NOT_VERIFIED')
  const accessToken = await signJwt({ sub: user.id, email: user.email, businessId: user.businessId })
  return json({
    accessToken,
    user: { id: user.id, email: user.email, name: user.name, businessId: user.businessId },
    hasBusiness: !!user.businessId,
  })
}

async function authPasswordForgot(body: Record<string, unknown>) {
  if (!RESEND_API_KEY) return err('Password reset is temporarily unavailable', 503)
  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return err('Invalid email address', 400)
  }
  const email = body.email.trim().toLowerCase()
  const supabase = db()
  const { data: user } = await supabase.from('User').select('id,email,passwordHash').eq('email', email).maybeSingle()

  // Do not reveal whether an address exists. For unknown or Google-only users,
  // return the same successful response as a known password account.
  if (!user?.passwordHash || !user.email) return json({ sent: true })

  await supabase.from('PasswordReset').update({ consumed: true }).eq('userId', user.id).eq('consumed', false)
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  const { error } = await supabase.from('PasswordReset').insert({
    id: newId('reset'), userId: user.id, token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })
  if (error || !await sendPasswordResetEmail(email, token)) return err('Could not send password reset email', 503)
  return json({ sent: true })
}

async function authPasswordReset(body: Record<string, unknown>) {
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token) ||
      typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return err('Invalid or expired password reset link', 400)
  }
  const supabase = db()
  const { data: record } = await supabase.from('PasswordReset').select('id,userId').eq('token', body.token)
    .eq('consumed', false).gt('expiresAt', new Date().toISOString()).maybeSingle()
  if (!record) return err('Invalid or expired password reset link', 400)

  const passwordHash = await bcrypt.hash(body.password, 12)
  const { data: user, error: userError } = await supabase.from('User').update({ passwordHash, emailVerified: true })
    .eq('id', record.userId).select('id,email,phone,name,businessId').single()
  const { error: resetError } = await supabase.from('PasswordReset').update({ consumed: true })
    .eq('id', record.id).eq('consumed', false)
  if (userError || resetError || !user) return err('Could not reset password', 500)

  const accessToken = await signJwt({ sub: user.id, email: user.email, phone: user.phone, businessId: user.businessId })
  return json({ accessToken, user, hasBusiness: !!user.businessId })
}

async function authEmailVerify(body: Record<string, unknown>) {
  if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return err('Invalid verification link', 400)
  const supabase = db()
  const { data: record } = await supabase.from('EmailVerification').select('id,userId').eq('token', body.token)
    .eq('consumed', false).gt('expiresAt', new Date().toISOString()).maybeSingle()
  if (!record) return err('Invalid or expired verification link', 400)
  const { data: consumed } = await supabase.from('EmailVerification').update({ consumed: true })
    .eq('id', record.id).eq('consumed', false).select('id').maybeSingle()
  if (!consumed) return err('Invalid or expired verification link', 400)
  const { data: user, error } = await supabase.from('User').update({ emailVerified: true })
    .eq('id', record.userId).select('id,email,phone,name,businessId').single()
  if (error || !user) return err('Could not verify email', 500)
  const accessToken = await signJwt({ sub: user.id, email: user.email, businessId: user.businessId })
  return json({ accessToken, user, hasBusiness: !!user.businessId })
}

async function authLogout(token: string) {
  const claims = await verifyJwt(token)
  if (!claims || typeof claims.jti !== 'string') return err('Unauthorized', 401)
  const { error } = await db().from('TokenBlacklist').upsert({
    jti: claims.jti,
    expiresAt: new Date((claims.exp as number) * 1000).toISOString(),
  }, { onConflict: 'jti' })
  if (error) return err('Could not log out', 500)
  return json({ loggedOut: true })
}

// ── BUSINESS ─────────────────────────────────────────────────────────────────

async function handleBusiness(req: Request, user: Record<string, unknown>) {
  const supabase = db()
  const bizId = user.businessId as string
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('Business').select('*').eq('id', bizId).single()
    if (error) return error.code === 'PGRST116' ? err('Business not found', 404) : err('Service temporarily unavailable', 503)
    return json(data)
  }
  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return err('Invalid business update')
    const allowed = ['name', 'city', 'vatEnabled', 'vatNumber']
    if (Object.keys(body).some(key => !allowed.includes(key))) return err('Field cannot be changed', 400)
    if (invalidVatNumber(body.vatNumber)) return err('Invalid VAT number', 400, 'INVALID_VAT_NUMBER')
    if ('name' in body) {
      if (invalidBusinessName(body.name)) return err('Business name is required', 400, 'INVALID_BUSINESS_NAME')
      body.name = body.name.trim()
    }
    const { data, error } = await supabase.from('Business').update(body).eq('id', bizId).select().single()
    if (error || !data) return err('Business not found', 404)
    return json(data)
  }
  return err('Method not allowed', 405)
}

async function handleOnboarding(req: Request, user: Record<string, unknown>) {
  if (req.method !== 'POST') return err('Method not allowed', 405)
  if (user.businessId) return err('Business already set up', 409)
  const body = await req.json()
  if (invalidVatNumber(body.vatNumber) || (body.vatEnabled === true && !body.vatNumber)) {
    return err('Invalid VAT number', 400, 'INVALID_VAT_NUMBER')
  }
  if (invalidBusinessName(body.name)) return err('Business name is required', 400, 'INVALID_BUSINESS_NAME')
  const supabase = db()
  const userId = user.sub as string
  const bizId = newId('biz')
  const ownerPhone = (user.phone as string | undefined) ?? null
  const { data: business, error } = await supabase.from('Business').insert({
    id: bizId, ownerPhone, name: body.name.trim(), city: body.city,
    vatEnabled: body.vatEnabled ?? false, vatNumber: body.vatNumber ?? null,
  }).select().single()
  if (error) return err('Could not save record', 400)
  await supabase.from('User').update({ businessId: bizId }).eq('id', userId)
  const accessToken = await signJwt({ sub: userId, phone: user.phone, email: user.email, googleId: user.googleId, businessId: bizId })
  return json({ accessToken, business }, 201)
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

type Summary = {
  totalSales: number; totalPurchases: number; costOfGoodsSold: number; operatingExpenses: number
  invoiceCount: number; paidInvoicesCount: number; unpaidInvoicesCount: number; unpaidInvoicesTotal: number
  unpaidInvoices: Record<string, unknown>[]; lowStock: Record<string, unknown>[]
}

// Totals are summed in SQL so they are never cut short by the API's row cap.
async function loadSummary(bizId: string, month: string | null) {
  const range = monthRange(month)
  return await db().rpc('dashboard_summary', {
    p_business_id: bizId,
    p_start: range?.start ?? null, p_end: range?.end ?? null,
    p_start_date: range?.startDate ?? null, p_end_date: range?.endDate ?? null,
  }) as { data: Partial<Summary> | null; error: unknown }
}

// Legacy shape, still used by the mobile app.
async function handleDashboard(user: Record<string, unknown>) {
  const bizId = user.businessId as string
  if (!bizId) return json({ revenue: { total: 0, thisMonth: 0 }, expenses: { total: 0, thisMonth: 0 }, profit: { total: 0, thisMonth: 0 }, invoiceCount: 0, paidInvoices: 0, pendingInvoices: 0, recentInvoices: [] })
  const [all, month, recent] = await Promise.all([
    loadSummary(bizId, null),
    loadSummary(bizId, currentRiyadhMonth()),
    db().from('Invoice').select('id,total,paidAmount,status,createdAt,customer:Customer(name)').eq('businessId', bizId)
      .order('createdAt', { ascending: false }).limit(5),
  ])
  if (all.error || month.error || recent.error) return err('Could not load report', 503)
  const a = all.data ?? {}, m = month.data ?? {}
  return json({
    revenue: { total: a.totalSales ?? 0, thisMonth: m.totalSales ?? 0 },
    expenses: { total: a.operatingExpenses ?? 0, thisMonth: m.operatingExpenses ?? 0 },
    profit: { total: (a.totalSales ?? 0) - (a.operatingExpenses ?? 0), thisMonth: (m.totalSales ?? 0) - (m.operatingExpenses ?? 0) },
    invoiceCount: a.invoiceCount ?? 0,
    paidInvoices: a.paidInvoicesCount ?? 0,
    pendingInvoices: a.unpaidInvoicesCount ?? 0,
    recentInvoices: recent.data ?? [],
  })
}

async function handleDashboardSummary(user: Record<string, unknown>, month: string | null) {
  const bizId = user.businessId as string
  const empty = { totalSales: 0, totalPurchases: 0, costOfGoodsSold: 0, operatingExpenses: 0, totalExpenses: 0, netProfit: 0, cashFlow: 0, unpaidInvoices: [], unpaidInvoicesCount: 0, unpaidInvoicesTotal: 0, unpaidInvoicesLimitedTo: 5, lowStock: [] }
  if (!bizId) return json(empty)

  const { data, error } = await loadSummary(bizId, month)
  if (error) return err('Could not load report', 503)
  const r = data ?? {}
  const totalSales = r.totalSales ?? 0
  const totalPurchases = r.totalPurchases ?? 0
  const costOfGoodsSold = r.costOfGoodsSold ?? 0
  const operatingExpenses = r.operatingExpenses ?? 0
  const totalExpenses = costOfGoodsSold + operatingExpenses
  return json({
    totalSales, totalPurchases, costOfGoodsSold, operatingExpenses, totalExpenses,
    netProfit: totalSales - totalExpenses,
    cashFlow: totalSales - totalPurchases - operatingExpenses,
    unpaidInvoices: (r.unpaidInvoices ?? []).map(({ createdAt: _createdAt, ...invoice }) => invoice),
    unpaidInvoicesCount: r.unpaidInvoicesCount ?? 0,
    unpaidInvoicesTotal: r.unpaidInvoicesTotal ?? 0,
    unpaidInvoicesLimitedTo: 5,
    lowStock: r.lowStock ?? [],
  })
}

function pageOf(url: URL | undefined, defaultLimit = 100): { from: number; to: number } {
  const page = Math.max(1, Number.parseInt(url?.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(Math.max(Number.parseInt(url?.searchParams.get('limit') ?? String(defaultLimit), 10) || defaultLimit, 1), MAX_PAGE_SIZE)
  return { from: (page - 1) * limit, to: page * limit - 1 }
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────

async function handleInventory(req: Request, user: Record<string, unknown>, sub?: string, url?: URL) {
  const supabase = db()
  const bizId = user.businessId as string
  if (!bizId) return json([])

  if (sub === 'movements') {
    if (req.method !== 'GET') return err('Method not allowed', 405)
    const { from, to } = pageOf(url, MAX_PAGE_SIZE)
    const { data, error } = await supabase.from('StockMovement').select('*, material:Material(id,name,unit)').eq('businessId', bizId)
      .order('createdAt', { ascending: false }).range(from, to)
    if (error) return err('Service temporarily unavailable', 503)
    return json(data ?? [])
  }

  if (sub === 'adjust') {
    if (req.method !== 'POST') return err('Method not allowed', 405)
    const body = await req.json()
    const { materialId, newQty, note } = body ?? {}
    if (typeof materialId !== 'string' || !validAmount(newQty, true) ||
        (note != null && (typeof note !== 'string' || note.length > MAX_TEXT_LENGTH))) {
      return err('Invalid stock adjustment', 400)
    }
    // One transaction: the count, the new balance and its movement row.
    const { data, error } = await supabase.rpc('adjust_material_stock', {
      p_business_id: bizId, p_material_id: materialId, p_new_qty: newQty, p_note: note ?? null,
    })
    if (error) {
      if (error.message?.includes('Material not found')) return err('Material not found', 404)
      console.error('Stock adjustment failed', error.code)
      return err('Could not adjust stock', 500)
    }
    return json(data)
  }

  if (req.method === 'GET') {
    const { data: materials, error } = await supabase.from('Material').select('*').eq('businessId', bizId).order('name', { ascending: true })
    if (error) return err('Service temporarily unavailable', 503)
    const result = (materials ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      lowStock: m.reorderLevel != null && (m.stockQty as number) <= (m.reorderLevel as number),
    }))
    return json(result)
  }

  return err('Method not allowed', 405)
}

// ── PURCHASES SUMMARY ────────────────────────────────────────────────────────

async function handlePurchasesSummary(user: Record<string, unknown>) {
  const bizId = user.businessId as string
  if (!bizId) return json({ bySupplier: [], byMonth: [] })
  const { data, error } = await db().rpc('purchases_summary', { p_business_id: bizId })
  if (error) return err('Could not load report', 503)
  return json(data ?? { bySupplier: [], byMonth: [] })
}

// ── GENERIC CRUD ──────────────────────────────────────────────────────────────

const TABLE_SELECTS: Record<string, string> = {
  Invoice: '*, items:InvoiceItem(*), customer:Customer(name,phone)',
  Purchase: '*, items:PurchaseItem(*), supplier:Supplier(name)',
  Product: '*',
  Expense: '*',
  Customer: '*',
  Supplier: '*',
  Material: '*',
  StockMovement: '*, material:Material(name,unit)',
}

const RELATION_TABLES: Record<string, Record<string, string>> = {
  Invoice: { customerId: 'Customer' },
  Purchase: { supplierId: 'Supplier' },
  StockMovement: { materialId: 'Material' },
  InvoiceItem: { productId: 'Product' },
  PurchaseItem: { materialId: 'Material' },
}

async function foreignKeysBelongToBusiness(
  supabase: ReturnType<typeof db>, table: string, row: Record<string, unknown>, bizId: string,
): Promise<boolean> {
  for (const [field, relatedTable] of Object.entries(RELATION_TABLES[table] ?? {})) {
    const id = row[field]
    if (id == null) continue
    if (typeof id !== 'string') return false
    const { data } = await supabase.from(relatedTable).select('id').eq('id', id).eq('businessId', bizId).maybeSingle()
    if (!data) return false
  }
  return true
}

// ── INPUT VALIDATION ─────────────────────────────────────────────────────────
// The browser validates too, but the API is callable directly, so every money
// field and enum is re-checked here.

const MAX_AMOUNT = 100_000_000
const MAX_TEXT_LENGTH = 2000
const MAX_PAGE_SIZE = 200
const EXPENSE_CATEGORIES = ['RENT', 'SALARIES', 'INGREDIENTS', 'PACKAGING', 'MARKETING', 'DELIVERY', 'UTILITIES', 'OTHER']
const INVOICE_STATUSES = ['PAID', 'UNPAID', 'PARTIAL']

function validAmount(value: unknown, allowZero = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0) && value <= MAX_AMOUNT
}

function validDate(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function hasOversizedText(row: Record<string, unknown>): boolean {
  return Object.values(row).some(v => typeof v === 'string' && v.length > MAX_TEXT_LENGTH)
}

function validateExpense(body: Record<string, unknown>, isCreate: boolean): string | null {
  if ((isCreate || 'amount' in body) && !validAmount(body.amount)) return 'Invalid amount'
  if ((isCreate || 'category' in body) && !EXPENSE_CATEGORIES.includes(body.category as string)) return 'Invalid category'
  if ((isCreate || 'date' in body) && !validDate(body.date)) return 'Invalid date'
  if (body.note != null && typeof body.note !== 'string') return 'Invalid note'
  return null
}

/**
 * Keeps paidAmount consistent with status: PAID → total, UNPAID → 0,
 * PARTIAL → strictly between 0 and total. Totals themselves are immutable
 * after creation (they are computed from items by create_invoice_with_inventory).
 */
async function normalizeInvoiceUpdate(
  supabase: ReturnType<typeof db>, id: string, bizId: string, body: Record<string, unknown>,
): Promise<Response | null> {
  if (['number', 'subtotal', 'vatAmount', 'total', 'issueDate', 'idempotencyKey', 'idempotencyHash'].some(key => key in body)) return err('Field cannot be changed', 400)
  if ('status' in body && !INVOICE_STATUSES.includes(body.status as string)) return err('Invalid status', 400)
  if ('dueDate' in body && body.dueDate != null && !validDate(body.dueDate)) return err('Invalid due date', 400)
  if (!('status' in body) && !('paidAmount' in body)) return null
  const { data: invoice } = await supabase.from('Invoice').select('total,status,paidAmount').eq('id', id).eq('businessId', bizId).maybeSingle()
  if (!invoice) return err('Not found', 404)
  const total = invoice.total as number
  const status = (body.status as string | undefined) ?? (invoice.status as string)
  if (status === 'PAID') {
    body.paidAmount = total
  } else if (status === 'UNPAID') {
    body.paidAmount = 0
  } else {
    const paid = 'paidAmount' in body ? body.paidAmount : invoice.paidAmount
    if (!validAmount(paid) || paid >= total) return err('Partial payment must be above zero and below the total', 400)
    body.paidAmount = paid
  }
  body.status = status
  return null
}

function hasImmutableFields(row: Record<string, unknown>): boolean {
  return ['id', 'businessId', 'createdAt', 'updatedAt', 'invoiceId', 'purchaseId'].some(key => key in row)
}

async function handlePurchase(req: Request, user: Record<string, unknown>, id?: string, url?: URL) {
  if (req.method === 'POST' && id) return err('Method not allowed', 405)
  if (req.method !== 'POST') return handleCrud(req, user, 'Purchase', id, url)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid purchase', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100 ||
      (body.supplierId != null && typeof body.supplierId !== 'string') ||
      (body.supplierName != null && typeof body.supplierName !== 'string') ||
      (body.date != null && typeof body.date !== 'string') ||
      (body.notes != null && typeof body.notes !== 'string') ||
      (body.source != null && !['MANUAL', 'OCR'].includes(body.source as string))) {
    return err('Invalid purchase', 400)
  }
  const { data, error } = await db().rpc('create_purchase_with_inventory', {
    p_business_id: user.businessId as string,
    p_supplier_id: (body.supplierId as string | undefined) ?? null,
    p_supplier_name: (body.supplierName as string | undefined) ?? null,
    p_date: (body.date as string | undefined) ?? null,
    p_source: (body.source as string | undefined) ?? 'MANUAL',
    p_notes: (body.notes as string | undefined) ?? null,
    p_items: body.items,
  })
  if (error) {
    console.error('Purchase transaction failed', error.code, error.message)
    return err(error.message.includes('Material not found') || error.message.includes('Supplier not found')
      ? error.message : 'Could not save purchase', 400)
  }
  return json(data, 201)
}

async function handleProduct(req: Request, user: Record<string, unknown>, id?: string, url?: URL) {
  if ((req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') || (req.method !== 'POST' && !id)) return handleCrud(req, user, 'Product', id, url)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid product', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.name != null && typeof body.name !== 'string') ||
      (body.category != null && typeof body.category !== 'string') ||
      (body.overheadCost != null && typeof body.overheadCost !== 'number') ||
      (body.profitMargin != null && typeof body.profitMargin !== 'number') ||
      (body.recipeItems != null && !Array.isArray(body.recipeItems)) ||
      (req.method === 'POST' && (!body.name || !Array.isArray(body.recipeItems)))) return err('Invalid product', 400)
  const { data, error } = await db().rpc('save_product_with_recipe', {
    p_business_id: user.businessId as string, p_product_id: id ?? null,
    p_name: (body.name as string | undefined) ?? null, p_category: (body.category as string | undefined) ?? null,
    p_overhead_cost: (body.overheadCost as number | undefined) ?? null,
    p_profit_margin: (body.profitMargin as number | undefined) ?? null,
    p_recipe_items: (body.recipeItems as unknown[] | undefined) ?? null,
  })
  if (error) {
    console.error('Product transaction failed', error.code, error.message)
    return err(error.message.includes('not found') ? error.message : 'Could not save product', 400)
  }
  return json(data, req.method === 'POST' ? 201 : 200)
}

async function handleInvoice(req: Request, user: Record<string, unknown>, id?: string, url?: URL) {
  // POST /invoices/<id> used to fall through to the generic update and could
  // rewrite totals and payments that only the invoice transaction may set.
  if (req.method === 'POST' && id) return err('Method not allowed', 405)
  if (req.method === 'DELETE' && id) {
    const { data: deleted, error } = await db().rpc('delete_invoice_with_inventory', {
      p_business_id: user.businessId as string, p_invoice_id: id,
    })
    if (error) {
      console.error('Invoice delete failed', error.code)
      return err('Could not delete invoice', 500)
    }
    if (deleted !== true) return err('Not found', 404)
    return new Response(null, { status: 204, headers: CORS })
  }
  if (req.method !== 'POST') return handleCrud(req, user, 'Invoice', id, url)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid invoice', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.customerId != null && typeof body.customerId !== 'string') ||
      (body.status != null && !['PAID', 'UNPAID'].includes(body.status as string)) ||
      (body.dueDate != null && typeof body.dueDate !== 'string') ||
      (body.notes != null && typeof body.notes !== 'string') ||
      !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return err('Invalid invoice', 400)
  const idempotencyKey = req.headers.get('Idempotency-Key')
  if (idempotencyKey != null && !/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) {
    return err('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY')
  }
  const { data, error } = await db().rpc('create_invoice_with_inventory', {
    p_business_id: user.businessId as string, p_customer_id: (body.customerId as string | undefined) ?? null,
    p_status: (body.status as string | undefined) ?? 'UNPAID',
    p_due_date: (body.dueDate as string | undefined) ?? null,
    p_notes: (body.notes as string | undefined) ?? null, p_items: body.items,
    p_idempotency_key: idempotencyKey,
  })
  if (error) {
    console.error('Invoice transaction failed', error.code, error.message)
    const shortage = /^Insufficient stock: (.*)$/.exec(error.message)
    if (shortage) return err(error.message, 409, 'INSUFFICIENT_STOCK', { material: shortage[1] })
    if (error.message === 'Idempotency key reused') {
      return err('This idempotency key was already used for a different invoice', 422, 'IDEMPOTENCY_KEY_REUSED')
    }
    if (error.message.includes('not found') || /^Invalid invoice/.test(error.message)) return err(error.message, 400)
    // Anything else (timeouts, dropped connections) may have committed; a 5xx
    // tells the web app to retry with the same key instead of a new one.
    return err('Could not create invoice', 500)
  }
  // Apply invoice_paid_amount_atomic before deploying this version: paidAmount
  // is now part of the same transaction as the invoice and stock movements.
  return json(data, (data as { replayed?: boolean } | null)?.replayed ? 200 : 201)
}

async function createMaterial(supabase: ReturnType<typeof db>, bizId: string, body: Record<string, unknown>) {
  const allowed = ['name', 'unit', 'purchasePrice', 'purchaseQty', 'vatRate', 'initialQty', 'reorderLevel']
  if (Object.keys(body).some(key => !allowed.includes(key)) ||
      typeof body.name !== 'string' || !body.name.trim() ||
      !['KG', 'GRAM', 'LITER', 'ML', 'PIECE'].includes(body.unit as string) ||
      !validAmount(body.purchasePrice, true) || !validAmount(body.purchaseQty) ||
      !validAmount(body.initialQty ?? 0, true) ||
      !validAmount(body.vatRate ?? 0, true) || Number(body.vatRate ?? 0) > 100 ||
      (body.reorderLevel != null && !validAmount(body.reorderLevel, true)) ||
      !Number.isFinite(Number(body.purchasePrice) / Number(body.purchaseQty))) {
    return err('تحقق من اسم الصنف والوحدة والسعر والكمية', 400)
  }
  const { data, error } = await supabase.rpc('create_material_with_opening_balance', {
    p_business_id: bizId,
    p_material_id: newId('material'),
    p_body: { ...body, name: body.name.trim() },
  })
  if (error) {
    console.error('Material creation failed', { code: error.code })
    return err('تعذر حفظ الصنف، حاول مرة أخرى', 500)
  }
  return json(data, 201)
}

async function handleCrud(req: Request, user: Record<string, unknown>, table: string, id?: string, url?: URL) {
  const supabase = db()
  const bizId = user.businessId as string
  if (!bizId) return err('Business not set up', 403)
  const sel = TABLE_SELECTS[table] ?? '*'

  if (req.method === 'GET') {
    if (id) {
      let one = supabase.from(table).select(sel).eq('id', id).eq('businessId', bizId)
      if (table === 'Invoice') one = one.order('position', { referencedTable: 'items', ascending: true })
      const { data, error } = await one.single()
      if (error && error.code !== 'PGRST116') return err('Service temporarily unavailable', 503)
      if (!data) return err('Not found', 404)
      return json(data)
    }
    const range = monthRange(url?.searchParams.get('month') ?? null)
    const { from, to } = pageOf(url)
    let q = supabase.from(table).select(sel).eq('businessId', bizId).order('createdAt', { ascending: false }).range(from, to)
    if (range) {
      // Expenses and purchases are filtered by their business date, matching the dashboard.
      if (table === 'Expense' || table === 'Purchase') {
        q = q.gte('date', range.startDate).lt('date', range.endDate)
      } else {
        q = q.gte('createdAt', range.start).lt('createdAt', range.end)
      }
    }
    const { data, error } = await q
    if (error) return err('Service temporarily unavailable', 503)
    return json(data ?? [])
  }

  if (req.method === 'POST' && id) return err('Method not allowed', 405)

  if (req.method === 'POST') {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body) || hasImmutableFields(body)) return err('Invalid record', 400)
    if (hasOversizedText(body)) return err('Text is too long', 400)
    if (table === 'Material') return createMaterial(supabase, bizId, body)
    if (table === 'Expense') {
      const invalid = validateExpense(body, true)
      if (invalid) return err(invalid, 400)
    }
    const items = body.items
    if (items != null && (!Array.isArray(items) || !['Invoice', 'Purchase'].includes(table) || items.length > 100)) return err('Invalid items', 400)
    delete body.items
    if (!await foreignKeysBelongToBusiness(supabase, table, body, bizId)) return err('Related record not found', 404)
    const childTable = table === 'Invoice' ? 'InvoiceItem' : table === 'Purchase' ? 'PurchaseItem' : null
    if (items?.length && childTable) {
      if (items.some((it: unknown) => !it || typeof it !== 'object' || Array.isArray(it) || hasImmutableFields(it as Record<string, unknown>))) return err('Invalid item', 400)
      for (const it of items as Record<string, unknown>[]) {
        if (!await foreignKeysBelongToBusiness(supabase, childTable, it, bizId)) return err('Related item record not found', 404)
      }
    }
    const rowId = newId(table.toLowerCase())
    const { data, error } = await supabase.from(table).insert({ ...body, id: rowId, businessId: bizId }).select().single()
    if (error) return err('Could not save record', 400)
    if (items?.length) {
      if (childTable) {
        const fk = table === 'Invoice' ? 'invoiceId' : 'purchaseId'
        const { error: itemError } = await supabase.from(childTable).insert(items.map((it: Record<string, unknown>) => ({ ...it, id: newId(childTable.toLowerCase()), [fk]: rowId })))
        if (itemError) {
          await supabase.from(table).delete().eq('id', rowId).eq('businessId', bizId)
          return err('Could not save items', 500)
        }
      }
    }
    const { data: full } = await supabase.from(table).select(sel).eq('id', rowId).single()
    return json(full ?? data, 201)
  }

  if ((req.method === 'PATCH' || req.method === 'PUT') && id) {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body) || hasImmutableFields(body)) return err('Invalid record update', 400)
    if (hasOversizedText(body)) return err('Text is too long', 400)
    if (table === 'Expense') {
      const invalid = validateExpense(body, false)
      if (invalid) return err(invalid, 400)
    }
    if (table === 'Invoice') {
      const invalid = await normalizeInvoiceUpdate(supabase, id, bizId, body)
      if (invalid) return invalid
    }
    // Purchase totals and numbers come from create_purchase_with_inventory and
    // already moved stock; editing them alone would desync the books.
    if (table === 'Purchase' && ['number', 'total', 'subtotal', 'vatAmount', 'source'].some(key => key in body)) {
      return err('Field cannot be changed', 400)
    }
    if (!await foreignKeysBelongToBusiness(supabase, table, body, bizId)) return err('Related record not found', 404)
    const { data, error } = await supabase.from(table).update(body).eq('id', id).eq('businessId', bizId).select(sel).single()
    if (error || !data) return err('Not found', 404)
    return json(data)
  }

  if (req.method === 'DELETE' && id) {
    const { data: deleted } = await supabase.from(table).delete().eq('id', id).eq('businessId', bizId).select('id')
    if (!deleted?.length) return err('Not found', 404)
    return new Response(null, { status: 204, headers: CORS })
  }

  return err('Method not allowed', 405)
}

// ── ROUTER ────────────────────────────────────────────────────────────────────

const PUBLIC_AUTH_PATHS = new Set([
  '/auth/otp/request', '/auth/otp/verify', '/auth/demo', '/auth/google', '/auth/email/register',
  '/auth/email/login', '/auth/email/verify', '/auth/password/forgot', '/auth/password/reset',
])

async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const path = normalizePath(url.pathname)
  const seg = path.split('/').filter(Boolean)

  try {
    if (path === '/health' || path === '') return json({ status: 'ok' })
    // Cap all API traffic by its platform-provided client IP. Individual auth
    // endpoints have tighter per-IP and per-identity limits below. For signed-in
    // routes the cap runs alongside the session lookup instead of before it.
    const ipLimit = rateLimit(req, 'api', null, 100)
    if (req.method === 'POST' && PUBLIC_AUTH_PATHS.has(path)) {
      const limited = await ipLimit
      if (limited) return limited
    }
    if (req.method === 'POST' && path === '/auth/otp/request') {
      if (!PHONE_LOGIN_ENABLED) return err('Phone verification is temporarily unavailable', 503)
      const body = await req.json()
      const limited = await rateLimit(req, 'otp-request', body.phone, 3)
      return limited ?? await authOtpRequest(body.phone)
    }
    if (req.method === 'POST' && path === '/auth/otp/verify') {
      if (!PHONE_LOGIN_ENABLED) return err('Phone verification is temporarily unavailable', 503)
      const body = await req.json()
      return await rateLimit(req, 'otp-verify', body.phone, 10) ?? authOtpVerify(body.phone, body.code)
    }
    if (req.method === 'POST' && path === '/auth/demo') {
      const body = await req.json()
      if (!DEMO_AUTH_ENABLED) return err('Demo login is disabled', 404)
      return await rateLimit(req, 'demo', body.phone, 10) ?? authDemoLogin(body.phone)
    }
    if (req.method === 'POST' && path === '/auth/google') {
      const body = await req.json()
      if (!GOOGLE_CLIENT_ID) return err('Google login is not configured', 503)
      return await rateLimit(req, 'google', body.credential, 20) ?? authGoogle(body.credential)
    }
    if (req.method === 'POST' && path === '/auth/email/register') {
      const body = await req.json()
      if (!RESEND_API_KEY) return err('Email registration is temporarily unavailable', 503)
      return await rateLimit(req, 'email-register', body.email, 5) ?? authEmailRegister(body)
    }
    if (req.method === 'POST' && path === '/auth/email/login') {
      const body = await req.json()
      return await rateLimit(req, 'email-login', body.email, 10) ?? authEmailLogin(body)
    }
    if (req.method === 'POST' && path === '/auth/email/verify') {
      const body = await req.json()
      return await rateLimit(req, 'email-verify', body.token, 10) ?? authEmailVerify(body)
    }
    if (req.method === 'POST' && path === '/auth/password/forgot') {
      const body = await req.json()
      return await rateLimit(req, 'password-forgot', body.email, 3) ?? authPasswordForgot(body)
    }
    if (req.method === 'POST' && path === '/auth/password/reset') {
      const body = await req.json()
      return await rateLimit(req, 'password-reset', body.token, 10) ?? authPasswordReset(body)
    }

    // getUser also applies the per-account cap in the same round trip.
    const [ipLimited, user] = await Promise.all([ipLimit, getUser(req)])
    if (ipLimited) return ipLimited
    if (user instanceof Response) return user

    if (path === '/auth/me' && req.method === 'GET') return authMe(user.sub as string)
    if (path === '/auth/logout' && req.method === 'POST') return authLogout(req.headers.get('Authorization')!.slice(7))
    if (seg[0] === 'business') return handleBusiness(req, user)
    if (path === '/onboarding' && req.method === 'POST') return handleOnboarding(req, user)
    if (path === '/dashboard' && req.method === 'GET') return handleDashboard(user)
    if (path === '/dashboard/summary' && req.method === 'GET') return handleDashboardSummary(user, url.searchParams.get('month'))
    if (seg[0] === 'inventory') return handleInventory(req, user, seg[1], url)
    if (path === '/purchases/summary' && req.method === 'GET') return handlePurchasesSummary(user)
    if (path === '/purchases/scan' && req.method === 'POST') return err('ميزة المسح غير متاحة في هذه النسخة', 501)
    if (seg[0] === 'invoices' && seg[2] === 'pdf') return err('تحميل PDF غير متاح حالياً', 501)
    if (seg[0] === 'invoices') return await handleInvoice(req, user, seg[1], url)
    if (seg[0] === 'expenses') return await handleCrud(req, user, 'Expense', seg[1], url)
    if (seg[0] === 'products') return await handleProduct(req, user, seg[1], url)
    if (seg[0] === 'purchases') return await handlePurchase(req, user, seg[1], url)
    if (seg[0] === 'customers') return await handleCrud(req, user, 'Customer', seg[1], url)
    if (seg[0] === 'suppliers') return await handleCrud(req, user, 'Supplier', seg[1], url)
    if (seg[0] === 'materials') return await handleCrud(req, user, 'Material', seg[1], url)
    if (seg[0] === 'stock-movements') return await handleCrud(req, user, 'StockMovement', seg[1], url)

    return err('Not found', 404)
  } catch (e) {
    // Request.json() errors cross the Deno fetch runtime boundary. Match the
    // stable error name/message instead of relying on realm-specific instanceof.
    const errorName = e && typeof e === 'object' && 'name' in e ? e.name : undefined
    const errorMessage = e instanceof Error ? e.message : String(e)
    if (errorName === 'SyntaxError' || /not valid JSON|Unexpected end of JSON input/i.test(errorMessage)) {
      return err('Invalid request body', 400)
    }
    console.error(e)
    return err('Server error', 500)
  }
}

Deno.serve(async (req: Request) => {
  const response = await handleRequest(req)
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => { headers[key] = value })
  Object.entries(corsFor(req)).forEach(([key, value]) => { headers[key] = value })
  return new Response(response.body, { status: response.status, headers })
})
