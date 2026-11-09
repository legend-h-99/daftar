import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { departments } from "./catalog";
export { departments, statuses } from "./catalog";
export const id = () => randomUUID();
function canonical(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.entries(x)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",") +
    "}"
  );
}
export const digest = (x: unknown) =>
  createHash("sha256").update(canonical(x)).digest("hex");
export const month = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
  }).format(now);
export function riyadh(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}
export class Fault extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const required = (x: unknown, max = 4000) =>
  z.string().trim().min(1).max(max).parse(x);
export const taskInput = z
  .object({
    goalId: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    department: z.enum([
      "management",
      "product",
      "engineering",
      "marketing",
      "growth",
      "customers",
      "data",
      "operations",
    ]),
    agent: z.string(),
    reviewer: z.string(),
    acceptance: z.string().trim().min(10).max(2000),
    context: z.string().max(10000).default(""),
  })
  .strict();
export function validateAgents(agent: string, reviewer: string, dept: string) {
  if (
    !departments.find((d) => d.id === dept)?.agents.some((a) => a === agent) ||
    !departments.some((d) => d.agents.some((a) => a === reviewer)) ||
    agent === reviewer
  )
    throw new Fault("يجب اختيار منفذ ومراجع مختلفين من الأدوار المعتمدة");
}
export const outputSchema = z
  .object({
    summary: z.string().min(1).max(16000),
    evidence: z.array(z.string().max(2000)).max(20),
    files: z
      .array(
        z
          .object({ path: z.string().max(250), content: z.string().max(50000) })
          .strict(),
      )
      .max(10),
    followups: z
      .array(
        z
          .object({
            title: z.string().min(3).max(200),
            department: taskInput.shape.department,
            acceptance: z.string().min(10).max(2000),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export type AgentOutput = z.infer<typeof outputSchema>;
export const actionInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("email"),
    payload: z
      .object({
        ticketId: z.string().uuid(),
        subject: z.string().trim().min(1).max(200),
        text: z.string().trim().min(1).max(16000),
      })
      .strict(),
  }),
  z.object({
    kind: z.enum(["publish", "spend", "merge", "deploy"]),
    payload: z
      .object({
        destination: z.string().trim().min(1).max(1000),
        content: z.string().trim().min(1).max(20000),
      })
      .strict(),
  }),
]);
