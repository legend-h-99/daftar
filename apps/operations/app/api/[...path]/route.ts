import { z } from "zod";
import { database } from "../../../src/db";
import { Fault } from "../../../src/domain";
import { command, snapshot, submitTicket } from "../../../src/service";
import { ipKey, login, logout, owner, sameOrigin } from "../../../src/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}
function supportHeaders(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== process.env.OPS_SUPPORT_ORIGIN)
    throw new Fault("مصدر الطلب غير مسموح", 403);
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
async function read(req: Request) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new Fault("صيغة غير مدعومة", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new Fault("طلب فارغ");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64000) {
      await reader.cancel();
      throw new Fault("الطلب أكبر من الحد المسموح", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new Fault("بيانات غير صالحة");
  }
}
async function route(req: Request) {
  let headers: Record<string, string> = {};
  try {
    const path = new URL(req.url).pathname;
    const db = database();
    if (path === "/api/support") {
      headers = supportHeaders(req);
      if (req.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      if (req.method !== "POST") throw new Fault("غير متاح", 405);
      return json(
        await submitTicket(db, await read(req), ipKey(req)),
        201,
        headers,
      );
    }
    if (req.method === "POST") sameOrigin(req);
    if (path === "/api/login" && req.method === "POST")
      return json({ ok: true }, 200, {
        "Set-Cookie": await login(db, await read(req), ipKey(req)),
      });
    await owner(db, req);
    if (path === "/api/state" && req.method === "GET")
      return json(await snapshot(db));
    if (path === "/api/logout" && req.method === "POST")
      return json({ ok: true }, 200, { "Set-Cookie": await logout(db, req) });
    if (path === "/api/command" && req.method === "POST")
      return json(await command(db, await read(req)));
    throw new Fault("غير موجود", 404);
  } catch (e) {
    if (e instanceof Fault)
      return json({ error: e.message }, e.status, headers);
    if (e instanceof z.ZodError)
      return json({ error: "تحقق من الحقول المطلوبة وأطوالها" }, 400, headers);
    console.error(
      "Operations request failed",
      e instanceof Error ? e.name : "unknown",
    );
    return json({ error: "الخدمة غير جاهزة أو تعذر حفظ الطلب" }, 503, headers);
  }
}
export const GET = route;
export const POST = route;
export const OPTIONS = route;
