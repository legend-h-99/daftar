import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, chmod, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Fault, type AgentOutput } from "./domain";
const exec = promisify(execFile);
const editable =
  /^apps\/web\/(app|components|lib|__tests__)\/[a-zA-Z0-9_./()\[\]-]+\.(tsx?|css)$/;
export function safeCodePath(p: string) {
  return (
    editable.test(p) &&
    !p.split("/").some((x) => x === ".." || x.startsWith(".")) &&
    !p.includes("//")
  );
}
async function git(repo: string, args: string[]) {
  return (
    await exec("git", ["-c", "core.hooksPath=/dev/null", "-C", repo, ...args], {
      maxBuffer: 4e6,
      timeout: 20000,
    })
  ).stdout;
}
export async function codeContext(context: string) {
  const repo = process.env.OPS_REPO_PATH;
  if (!repo) return { connected: false, notice: "بيئة التطوير غير متصلة" };
  const base = (await git(repo, ["rev-parse", "HEAD"])).trim();
  const paths = (
    await git(repo, ["ls-tree", "-r", "--name-only", "HEAD", "apps/web"])
  )
    .split("\n")
    .filter(safeCodePath);
  const selected = paths.filter((p) => context.includes(p)).slice(0, 4);
  const files = [];
  for (const p of selected) {
    const content = await git(repo, ["show", `${base}:${p}`]);
    if (Buffer.byteLength(content) > 10000)
      throw new Fault("الملف كبير؛ قسم مهمة التطوير");
    files.push({ path: p, content });
  }
  return {
    connected: true,
    base,
    files,
    availablePaths: paths.slice(0, 70),
    notice: files.length
      ? "مصدر الكود هو commit المحدد، لا توجد نتائج اختبار بعد"
      : "حدد مسارات الملفات المطلوبة في سياق المهمة قبل طلب تعديلها",
  };
}
export async function sandbox(
  taskId: string,
  base: string,
  files: AgentOutput["files"],
) {
  const repo = process.env.OPS_REPO_PATH;
  const image = process.env.OPS_SANDBOX_IMAGE;
  const artifacts = process.env.OPS_ARTIFACTS_DIR;
  if (!repo || !image || !artifacts)
    throw new Fault("بيئة Docker أو مسار المخرجات غير متصل");
  if (
    !/^[a-f0-9]{40}$/.test(base) ||
    !files.length ||
    files.some((f) => !safeCodePath(f.path)) ||
    new Set(files.map((f) => f.path)).size !== files.length
  )
    throw new Fault("مسارات تعديل غير مسموحة أو تغيير فارغ");
  if ((await git(repo, ["rev-parse", "HEAD"])).trim() !== base)
    throw new Fault("تغير الفرع الأساسي؛ أعد تشغيل المهمة والاختبارات");
  const dir = await mkdtemp(path.join(tmpdir(), "daftar-ops-"));
  await chmod(dir, 0o755);
  const name = `daftar-ops-${taskId}`;
  try {
    // Copy only tracked web code and build manifests. No .git, environment files, operations data or credentials.
    const tree = (await git(repo, ["ls-tree", "-r", base])).split("\n");
    for (const line of tree) {
      const match = line.match(/^(100644|100755) blob ([a-f0-9]+)\t(.+)$/);
      if (!match) continue;
      const p = match[3];
      if (
        !(
          p.startsWith("apps/web/") ||
          ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(p)
        )
      )
        continue;
      if (
        p.split("/").some((s) => s.startsWith(".")) ||
        /\.(pem|key|p12)$/.test(p) ||
        /secret|credential/i.test(p)
      )
        continue;
      const data = (
        await exec("git", ["-C", repo, "cat-file", "blob", match[2]], {
          encoding: "buffer",
          maxBuffer: 10e6,
          timeout: 20000,
        })
      ).stdout;
      await mkdir(path.dirname(path.join(dir, p)), { recursive: true });
      await writeFile(path.join(dir, p), data);
    }
    await git(dir, ["init", "-b", `codex/ops-${taskId}`]);
    await git(dir, ["add", "."]);
    await git(dir, [
      "-c",
      "user.name=Daftar Operations",
      "-c",
      "user.email=ops@localhost",
      "commit",
      "-m",
      `Snapshot of ${base}`,
    ]);
    for (const f of files) {
      await mkdir(path.dirname(path.join(dir, f.path)), { recursive: true });
      await writeFile(path.join(dir, f.path), f.content);
    }
    await git(dir, ["add", "-N", "."]);
    const patch = await git(dir, ["diff", "--binary"]);
    if (!patch.trim()) throw new Fault("لم ينتج تعديل فعلي");
    let passed = false,
      log = "";
    try {
      const result = await exec(
        "docker",
        [
          "run",
          "--rm",
          "--pull=never",
          "--name",
          name,
          "--network=none",
          "--read-only",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
          "--pids-limit=128",
          "--memory=2g",
          "--cpus=2",
          "--user",
          "1000:1000",
          "--tmpfs",
          "/tmp:rw,nosuid,size=256m",
          "--mount",
          `type=bind,source=${dir},target=/source,readonly`,
          image,
        ],
        { timeout: 120000, maxBuffer: 1000000 },
      );
      passed = true;
      log = result.stdout + "\n" + result.stderr;
    } catch (e: any) {
      log = String(e.stdout || "") + "\n" + String(e.stderr || e.message);
    }
    const head = (await git(repo, ["rev-parse", "HEAD"])).trim();
    if (head !== base) {
      passed = false;
      log += "\nتغير الفرع الأساسي؛ يجب إعادة الاختبار.";
    }
    const target = path.resolve(artifacts, taskId);
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "change.patch"), patch);
    await writeFile(path.join(target, "test.log"), log);
    return {
      passed,
      base,
      branch: `codex/ops-${taskId}`,
      patch,
      log: log.slice(-18000),
      artifactDirectory: target,
      preview: "معاينة فرق الكود؛ لا يوجد نشر تلقائي",
    };
  } finally {
    await exec("docker", ["rm", "-f", name], { timeout: 10000 }).catch(
      () => {},
    );
    await rm(dir, { recursive: true, force: true });
  }
}
