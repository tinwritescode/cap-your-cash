import { spawnSync } from "node:child_process";

// Runtime source and migration artifacts are both scanned; generated files
// with stable machine-owned output are excluded from the human duplication gate.
const result = spawnSync(
  "jscpd",
  [
    "src",
    "drizzle",
    "--ignore",
    "**/routeTree.gen.ts,**/integrations/supabase/**,**/drizzle/migrations/**",
    "--reporters",
    "console",
    "--min-tokens",
    "50",
    "--min-lines",
    "10",
    "--mode",
    "mild",
    "--baseline",
    ".jscpd-baseline.json",
    "--fail-on-new-clones",
    "0",
  ],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
