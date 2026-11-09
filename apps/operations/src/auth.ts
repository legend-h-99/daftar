import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import type { DB } from "./db";
import { Fault } from "./domain";
import { limit } from "./service";
const secure = () => process.env.NODE_ENV === "production";
export const cookieName = () =>
  secure() ? "__Host-ops-session" : "ops-session";
function secret() {
  const s = process.env.OPS_SESSION_SECRET;
  if (!s || s.length < 32) throw new Fault("إعداد الدخول غير مكتمل", 503);
  return s;
}
function sign(x: string) {
  return createHmac("sha256", secret()).update(x).digest("hex");
}
export function sameOrigin(req: Request) {
  if (req.headers.get("origin") !== process.env.OPS_ORIGIN)
    throw new Fault("مصدر الطلب غير مسموح", 403);
}
export function ipKey(req: Request) {
  const s = process.env.OPS_IP_HASH_SECRET;
  if (!s || s.length < 32) throw new Fault("إعداد الحماية غير مكتمل", 503);
  // Trust an upstream address only when the operator explicitly configured the trusted proxy header.
  const header = process.env.OPS_TRUSTED_IP_HEADER;
  const ip = header ? req.headers.get(header) || "unknown" : "shared";
  return createHmac("sha256", s).update(ip.slice(0, 200)).digest("hex");
}
export async function login(db: DB, input: unknown, key: string) {
  await limit(db, `login:${key}`, 10, 900);
  const { email, password } = z
    .object({
      email: z.string().email().max(254),
      password: z.string().max(300),
    })
    .strict()
    .parse(input);
  const configured = process.env.OPS_PASSWORD_HASH || "";
  const [salt, hash] = configured.split(":");
  if (!salt || !hash || hash.length !== 128 || !process.env.OPS_OWNER_EMAIL)
    throw new Fault("إعداد الدخول غير مكتمل", 503);
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(actual, expected) ||
    email.toLowerCase() !== process.env.OPS_OWNER_EMAIL.toLowerCase()
  )
    throw new Fault("بيانات الدخول غير صحيحة", 401);
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO ops_sessions(id,expires_at) VALUES($1,now()+interval '8 hours')",
    [sign(token)],
  );
  return `${cookieName()}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure() ? "; Secure" : ""}`;
}
function session(req: Request) {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(cookieName() + "="))
    ?.split("=")[1];
}
export async function owner(db: DB, req: Request) {
  const token = session(req);
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Fault("يلزم تسجيل الدخول", 401);
  const r = await db.query(
    "SELECT id FROM ops_sessions WHERE id=$1 AND expires_at>now()",
    [sign(token)],
  );
  if (!r.rows.length) throw new Fault("انتهت جلسة الدخول", 401);
}
export async function logout(db: DB, req: Request) {
  const token = session(req);
  if (token)
    await db.query("DELETE FROM ops_sessions WHERE id=$1", [sign(token)]);
  return `${cookieName()}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure() ? "; Secure" : ""}`;
}
