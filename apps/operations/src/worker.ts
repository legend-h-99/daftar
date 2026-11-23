import { database } from "./db";
import { schedule, intake } from "./service";
import { claim, processJob } from "./engine";
const db = database();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
console.log("Operations worker started; schedule: 09:00 Asia/Riyadh.");
while (!stopping) {
  try {
    await intake(db);
    await schedule(db);
    const job = await claim(db);
    if (job) {
      await processJob(db, job);
      continue;
    }
  } catch (e) {
    console.error(
      "Worker cycle failed",
      e instanceof Error ? e.name : "unknown",
    );
  }
  await new Promise((r) => setTimeout(r, 5000));
}
process.exit(0);
