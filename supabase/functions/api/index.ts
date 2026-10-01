import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://esm.sh/bcryptjs@3.0.3'

const CORS = {
  'access-control-allow-origin': 'https://daftar-ead.pages.dev',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

function db() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Database configuration missing')
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
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

async function getUser(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const claims = await verifyJwt(auth.slice(7))
  if (!claims) return null
  const supabase = db()
  if (typeof claims.jti === 'string') {
    const { data: revoked } = await supabase.from('TokenBlacklist').select('jti').eq('jti', claims.jti).maybeSingle()
    if (revoked) return null
  }
  const { data: account } = await supabase.from('User').select('id,phone,email,googleId,businessId').eq('id', claims.sub).maybeSingle()
  if (!account) return null
  return { ...claims, phone: account.phone, email: account.email, googleId: account.googleId, businessId: account.businessId }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
function err(msg: string, status = 400) {
  return json({ message: msg, statusCode: status }, status)
}

async function rateLimit(req: Request, action: string, identifier: unknown, limit: number): Promise<Response | null> {
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const identity = typeof identifier === 'string' ? identifier.trim().toLowerCase() : 'unknown'
  for (const key of [`${action}:ip:${ip}`, `${action}:account:${identity}`]) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
    const hashed = [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
    const { data, error } = await db().rpc('consume_auth_rate_limit', {
      p_key: hashed, p_limit: limit, p_window_seconds: 60,
    })
    if (error) return err('Authentication temporarily unavailable', 503)
    if (data !== true) return err('Too many requests; try again shortly', 429)
  }
  return null
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

function monthRange(month: string | null): { start: string; end: string } | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null
  const [y, m] = month.split('-').map(Number)
  const start = new Date(y, m - 1, 1).toISOString()
  const end = new Date(y, m, 1).toISOString()
  return { start, end }
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

async function authOtpRequest(_phone: string) {
  // Phone sign-in is unavailable until an SMS delivery provider is configured.
  // Never create a code that only the requester can retrieve from the API.
  return err('Phone verification is temporarily unavailable', 503)
}

async function authOtpVerify(phone: string, code: string) {
  const normalized = normalizePhone(phone)
  const supabase = db()
  const { data: otp } = await supabase.from('OtpCode').select('*').eq('phone', normalized).eq('consumed', false).gte('expiresAt', new Date().toISOString()).order('createdAt', { ascending: false }).limit(1).single()
  if (!otp) return err('Invalid or expired verification code')
  if (otp.code !== code) {
    const attempts = (otp.attempts || 0) + 1
    if (attempts >= 5) await supabase.from('OtpCode').update({ consumed: true, attempts }).eq('id', otp.id)
    else await supabase.from('OtpCode').update({ attempts }).eq('id', otp.id)
    return err('Invalid or expired verification code')
  }
  await supabase.from('OtpCode').update({ consumed: true }).eq('id', otp.id)
  const { data: existing } = await supabase.from('User').select('*').eq('phone', normalized).maybeSingle()
  const userId = existing?.id ?? newId('user')
  if (!existing) await supabase.from('User').insert({ id: userId, phone: normalized })
  const user = existing ?? { id: userId, phone: normalized, businessId: null }
  const accessToken = await signJwt({ sub: user.id, phone: normalized, businessId: user.businessId })
  return json({ accessToken, user: { id: user.id, phone: normalized, businessId: user.businessId }, hasBusiness: !!user.businessId })
}

async function authMe(userId: string) {
  const { data } = await db().from('User').select('id,phone,email,name,businessId,Business(*)').eq('id', userId).single()
  if (!data) return err('User not found', 404)
  return json({ ...data, business: data.Business, user: { id: data.id, phone: data.phone, email: data.email, businessId: data.businessId } })
}

function validEmailInput(email: unknown, password: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    typeof password === 'string' && password.length >= 8 && password.length <= 128
}

async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
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

async function authEmailLogin(body: Record<string, unknown>) {
  if (typeof body.email !== 'string' || typeof body.password !== 'string') return err('Invalid credentials', 401)
  const supabase = db()
  const email = body.email.trim().toLowerCase()
  const { data: user } = await supabase.from('User').select('id,email,phone,name,businessId,passwordHash,emailVerified').eq('email', email).maybeSingle()
  const invalid = () => err('Invalid credentials', 401)
  if (!user?.passwordHash || !await bcrypt.compare(body.password, user.passwordHash)) return invalid()
  if (!user.emailVerified) return err('Please verify your email address first', 403)
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
    const { data } = await supabase.from('Business').select('*').eq('id', bizId).single()
    return json(data)
  }
  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return err('Invalid business update')
    const allowed = ['name', 'city', 'vatEnabled', 'vatNumber']
    if (Object.keys(body).some(key => !allowed.includes(key))) return err('Field cannot be changed', 400)
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
  const supabase = db()
  const userId = user.sub as string
  const bizId = newId('biz')
  const ownerPhone = (user.phone as string | undefined) ?? null
  const { data: business, error } = await supabase.from('Business').insert({
    id: bizId, ownerPhone, name: body.name, city: body.city,
    vatEnabled: body.vatEnabled ?? false, vatNumber: body.vatNumber ?? null,
  }).select().single()
  if (error) return err('Could not save record', 400)
  await supabase.from('User').update({ businessId: bizId }).eq('id', userId)
  const accessToken = await signJwt({ sub: userId, phone: user.phone, email: user.email, googleId: user.googleId, businessId: bizId })
  return json({ accessToken, business }, 201)
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

async function handleDashboard(user: Record<string, unknown>) {
  const supabase = db()
  const bizId = user.businessId as string
  if (!bizId) return json({ revenue: { total: 0, thisMonth: 0 }, expenses: { total: 0, thisMonth: 0 }, profit: { total: 0, thisMonth: 0 }, invoiceCount: 0, paidInvoices: 0, pendingInvoices: 0, recentInvoices: [] })
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [inv, exp] = await Promise.all([
    supabase.from('Invoice').select('id,total,paidAmount,status,createdAt,customer:Customer(name)').eq('businessId', bizId),
    supabase.from('Expense').select('amount,date').eq('businessId', bizId),
  ])
  const invoices = inv.data ?? []
  const expenses = exp.data ?? []
  const paid = invoices.filter((i: Record<string, unknown>) => i.status === 'PAID')
  const partial = invoices.filter((i: Record<string, unknown>) => i.status === 'PARTIAL')
  const totalRevenue = [...paid, ...partial].reduce((s: number, i: Record<string, unknown>) => s + ((i.paidAmount as number) ?? 0), 0)
  const monthInv = invoices.filter((i: Record<string, unknown>) => (i.createdAt as string) >= startOfMonth)
  const monthRevenue = monthInv.filter((i: Record<string, unknown>) => i.status === 'PAID' || i.status === 'PARTIAL').reduce((s: number, i: Record<string, unknown>) => s + ((i.paidAmount as number) ?? 0), 0)
  const totalExp = expenses.reduce((s: number, e: Record<string, unknown>) => s + (e.amount as number), 0)
  const monthExp = expenses.filter((e: Record<string, unknown>) => (e.date as string) >= startOfMonth).reduce((s: number, e: Record<string, unknown>) => s + (e.amount as number), 0)
  return json({
    revenue: { total: totalRevenue, thisMonth: monthRevenue },
    expenses: { total: totalExp, thisMonth: monthExp },
    profit: { total: totalRevenue - totalExp, thisMonth: monthRevenue - monthExp },
    invoiceCount: invoices.length,
    paidInvoices: paid.length,
    pendingInvoices: invoices.filter((i: Record<string, unknown>) => i.status === 'UNPAID' || i.status === 'PARTIAL').length,
    recentInvoices: invoices.slice(0, 5),
  })
}

async function handleDashboardSummary(user: Record<string, unknown>, month: string | null) {
  const supabase = db()
  const bizId = user.businessId as string
  const empty = { totalSales: 0, totalPurchases: 0, costOfGoodsSold: 0, operatingExpenses: 0, totalExpenses: 0, netProfit: 0, unpaidInvoices: [], unpaidInvoicesCount: 0, unpaidInvoicesTotal: 0, unpaidInvoicesLimitedTo: 5, lowStock: [] }
  if (!bizId) return json(empty)

  const range = monthRange(month)

  let invQ = supabase.from('Invoice').select('id,number,total,paidAmount,status,dueDate,createdAt,customer:Customer(name)').eq('businessId', bizId)
  if (range) invQ = invQ.gte('createdAt', range.start).lt('createdAt', range.end)

  let purQ = supabase.from('Purchase').select('total,createdAt').eq('businessId', bizId)
  if (range) purQ = purQ.gte('createdAt', range.start).lt('createdAt', range.end)

  let expQ = supabase.from('Expense').select('amount,date').eq('businessId', bizId)
  if (range) expQ = expQ.gte('date', range.start.slice(0, 10)).lt('date', range.end.slice(0, 10))

  const matQ = supabase.from('Material').select('id,name,unit,stockQty,reorderLevel').eq('businessId', bizId).gt('reorderLevel', 0)

  const [invRes, purRes, expRes, matRes] = await Promise.all([invQ, purQ, expQ, matQ])

  const invoices = (invRes.data ?? []) as Record<string, unknown>[]
  const purchases = (purRes.data ?? []) as Record<string, unknown>[]
  const expenses = (expRes.data ?? []) as Record<string, unknown>[]
  const materials = (matRes.data ?? []) as Record<string, unknown>[]

  const totalSales = invoices.filter(i => i.status === 'PAID' || i.status === 'PARTIAL').reduce((s, i) => s + ((i.paidAmount as number) ?? 0), 0)
  const totalPurchases = purchases.reduce((s, p) => s + ((p.total as number) ?? 0), 0)
  const operatingExpenses = expenses.reduce((s, e) => s + (e.amount as number), 0)
  const totalExpenses = totalPurchases + operatingExpenses
  const netProfit = totalSales - totalExpenses

  const unpaidAll = invoices.filter(i => i.status === 'UNPAID' || i.status === 'PARTIAL')
  const unpaidInvoices = unpaidAll.slice(0, 5).map(i => ({
    id: i.id, number: i.number,
    customerName: (i.customer as Record<string, unknown>)?.name ?? null,
    total: i.total, dueDate: i.dueDate ?? null, status: i.status,
  }))

  const lowStock = materials
    .filter(mat => (mat.stockQty as number) <= (mat.reorderLevel as number))
    .map(mat => ({ id: mat.id, name: mat.name, unit: mat.unit, stockQty: mat.stockQty, reorderLevel: mat.reorderLevel }))

  return json({ totalSales, totalPurchases, costOfGoodsSold: totalPurchases, operatingExpenses, totalExpenses, netProfit, unpaidInvoices, unpaidInvoicesCount: unpaidAll.length, unpaidInvoicesTotal: unpaidAll.reduce((s, i) => s + ((i.total as number) - ((i.paidAmount as number) ?? 0)), 0), unpaidInvoicesLimitedTo: 5, lowStock })
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────

async function handleInventory(req: Request, user: Record<string, unknown>, sub?: string) {
  const supabase = db()
  const bizId = user.businessId as string
  if (!bizId) return json([])

  if (sub === 'movements') {
    if (req.method !== 'GET') return err('Method not allowed', 405)
    const { data } = await supabase.from('StockMovement').select('*, material:Material(id,name,unit)').eq('businessId', bizId).order('createdAt', { ascending: false })
    return json(data ?? [])
  }

  if (sub === 'adjust') {
    if (req.method !== 'POST') return err('Method not allowed', 405)
    const body = await req.json()
    const { materialId, newQty, note } = body
    const { data: mat, error: matErr } = await supabase.from('Material').select('*').eq('id', materialId).eq('businessId', bizId).single()
    if (matErr || !mat) return err('Material not found', 404)
    const delta = (newQty as number) - (mat.stockQty as number)
    const { data: updated } = await supabase.from('Material').update({ stockQty: newQty }).eq('id', materialId).eq('businessId', bizId).select().single()
    await supabase.from('StockMovement').insert({
      id: newId('mov'),
      businessId: bizId,
      materialId,
      type: 'ADJUSTMENT',
      qty: delta,
      balanceAfter: newQty,
      note: note ?? null,
    })
    return json(updated)
  }

  if (req.method === 'GET') {
    const { data: materials } = await supabase.from('Material').select('*').eq('businessId', bizId).order('name', { ascending: true })
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
  const supabase = db()
  const bizId = user.businessId as string
  if (!bizId) return json({ bySupplier: [], byMonth: [] })
  const { data: purchases } = await supabase.from('Purchase').select('total,createdAt,supplier:Supplier(name)').eq('businessId', bizId).order('createdAt', { ascending: false })
  const rows = (purchases ?? []) as Record<string, unknown>[]
  const supplierMap = new Map<string, { count: number; total: number }>()
  for (const p of rows) {
    const name = ((p.supplier as Record<string, unknown>)?.name as string) ?? 'غير محدد'
    const cur = supplierMap.get(name) ?? { count: 0, total: 0 }
    supplierMap.set(name, { count: cur.count + 1, total: cur.total + ((p.total as number) ?? 0) })
  }
  const bySupplier = [...supplierMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)
  const monthMap = new Map<string, { count: number; total: number }>()
  for (const p of rows) {
    const month = (p.createdAt as string).slice(0, 7)
    const cur = monthMap.get(month) ?? { count: 0, total: 0 }
    monthMap.set(month, { count: cur.count + 1, total: cur.total + ((p.total as number) ?? 0) })
  }
  const byMonth = [...monthMap.entries()].map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month))
  return json({ bySupplier, byMonth })
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

function hasImmutableFields(row: Record<string, unknown>): boolean {
  return ['id', 'businessId', 'createdAt', 'updatedAt', 'invoiceId', 'purchaseId'].some(key => key in row)
}

async function handlePurchase(req: Request, user: Record<string, unknown>, id?: string, url?: URL) {
  if (req.method !== 'POST' || id) return handleCrud(req, user, 'Purchase', id, url)
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
  if (req.method !== 'POST' || id) return handleCrud(req, user, 'Invoice', id, url)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return err('Invalid invoice', 400) }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.customerId != null && typeof body.customerId !== 'string') ||
      (body.status != null && !['PAID', 'UNPAID', 'PARTIAL'].includes(body.status as string)) ||
      (body.dueDate != null && typeof body.dueDate !== 'string') ||
      (body.notes != null && typeof body.notes !== 'string') ||
      !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return err('Invalid invoice', 400)
  const { data, error } = await db().rpc('create_invoice_with_inventory', {
    p_business_id: user.businessId as string, p_customer_id: (body.customerId as string | undefined) ?? null,
    p_status: (body.status as string | undefined) ?? 'UNPAID',
    p_due_date: (body.dueDate as string | undefined) ?? null,
    p_notes: (body.notes as string | undefined) ?? null, p_items: body.items,
  })
  if (error) {
    console.error('Invoice transaction failed', error.code, error.message)
    return err(error.message.includes('not found') ? error.message : 'Could not create invoice', 400)
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
      const { data, error } = await supabase.from(table).select(sel).eq('id', id).eq('businessId', bizId).single()
      if (error || !data) return err('Not found', 404)
      return json(data)
    }
    const month = url?.searchParams.get('month') ?? null
    const range = monthRange(month)
    const page = parseInt(url?.searchParams.get('page') ?? '1')
    const limit = parseInt(url?.searchParams.get('limit') ?? '100')
    let q = supabase.from(table).select(sel).eq('businessId', bizId).order('createdAt', { ascending: false }).range((page - 1) * limit, page * limit - 1)
    if (range) {
      if (table === 'Expense') {
        q = q.gte('date', range.start.slice(0, 10)).lt('date', range.end.slice(0, 10))
      } else {
        q = q.gte('createdAt', range.start).lt('createdAt', range.end)
      }
    }
    const { data } = await q
    return json(data ?? [])
  }

  if (req.method === 'POST') {
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body) || hasImmutableFields(body)) return err('Invalid record', 400)
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
    if (!await foreignKeysBelongToBusiness(supabase, table, body, bizId)) return err('Related record not found', 404)
    const { data, error } = await supabase.from(table).update(body).eq('id', id).eq('businessId', bizId).select(sel).single()
    if (error || !data) return err('Not found', 404)
    return json(data)
  }

  if (req.method === 'DELETE' && id) {
    await supabase.from(table).delete().eq('id', id).eq('businessId', bizId)
    return new Response(null, { status: 204, headers: CORS })
  }

  return err('Method not allowed', 405)
}

// ── ROUTER ────────────────────────────────────────────────────────────────────

async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const path = normalizePath(url.pathname)
  const seg = path.split('/').filter(Boolean)

  try {
    if (path === '/health' || path === '') return json({ status: 'ok' })
    if (req.method === 'POST' && path === '/auth/otp/request') return authOtpRequest((await req.json()).phone)
    if (req.method === 'POST' && path === '/auth/otp/verify') {
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

    const user = await getUser(req)
    if (!user) return err('Unauthorized', 401)

    if (path === '/auth/me' && req.method === 'GET') return authMe(user.sub as string)
    if (path === '/auth/logout' && req.method === 'POST') return authLogout(req.headers.get('Authorization')!.slice(7))
    if (seg[0] === 'business') return handleBusiness(req, user)
    if (path === '/onboarding' && req.method === 'POST') return handleOnboarding(req, user)
    if (path === '/dashboard' && req.method === 'GET') return handleDashboard(user)
    if (path === '/dashboard/summary' && req.method === 'GET') return handleDashboardSummary(user, url.searchParams.get('month'))
    if (seg[0] === 'inventory') return handleInventory(req, user, seg[1])
    if (path === '/purchases/summary' && req.method === 'GET') return handlePurchasesSummary(user)
    if (path === '/purchases/scan' && req.method === 'POST') return err('ميزة المسح غير متاحة في هذه النسخة', 501)
    if (seg[0] === 'invoices' && seg[2] === 'pdf') return err('تحميل PDF غير متاح حالياً', 501)
    if (seg[0] === 'invoices') return handleInvoice(req, user, seg[1], url)
    if (seg[0] === 'expenses') return handleCrud(req, user, 'Expense', seg[1], url)
    if (seg[0] === 'products') return handleProduct(req, user, seg[1], url)
    if (seg[0] === 'purchases') return handlePurchase(req, user, seg[1], url)
    if (seg[0] === 'customers') return handleCrud(req, user, 'Customer', seg[1], url)
    if (seg[0] === 'suppliers') return handleCrud(req, user, 'Supplier', seg[1], url)
    if (seg[0] === 'materials') return handleCrud(req, user, 'Material', seg[1], url)
    if (seg[0] === 'stock-movements') return handleCrud(req, user, 'StockMovement', seg[1], url)

    return err('Not found', 404)
  } catch (e) {
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

