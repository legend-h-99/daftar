import { randomBytes, scryptSync } from "node:crypto";
let password = "";
for await (const chunk of process.stdin) password += chunk;
password = password.trim();
if (password.length < 14)
  throw Error(
    "Use at least 14 characters; pipe the password through stdin, not command arguments.",
  );
const salt = randomBytes(16).toString("hex");
console.log(
  `OPS_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
);
console.log(`OPS_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
console.log(`OPS_IP_HASH_SECRET=${randomBytes(32).toString("hex")}`);
