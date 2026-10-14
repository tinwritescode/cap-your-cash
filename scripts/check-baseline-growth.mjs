import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const base = process.env.ARCHITECTURE_BASE_REF;
if (!base) throw new Error("Set ARCHITECTURE_BASE_REF to the reviewed base commit.");
for (const file of [".architecture-baseline.json", ".jscpd-baseline.json"]) {
  const current = JSON.parse(await readFile(file, "utf8"));
  let previous;
  try {
    previous = JSON.parse(
      execFileSync("git", ["show", `${base}:${file}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    // One-time bootstrap: a missing baseline must be reviewed in the initial PR.
    execFileSync("git", ["rev-parse", "--verify", `${base}^{commit}`], { stdio: "ignore" });
    console.log(`${file}: initial baseline; review required.`);
    continue;
  }
  const counts = (value) => {
    if (!Array.isArray(value)) return value.fingerprints;
    const result = {};
    for (const item of value) result[item.fingerprint] = (result[item.fingerprint] ?? 0) + 1;
    return result;
  };
  const oldCounts = counts(previous);
  for (const [key, count] of Object.entries(counts(current))) {
    if (count > (oldCounts[key] ?? 0)) {
      console.error(`${file}: baseline growth is forbidden (${key}). Fix the violation instead.`);
      process.exitCode = 1;
    }
  }
}
