// Copy the repo-root lessons files into public/ so they ship with every build
// (served at slop.computer/LESSONS.md + /ALL-LESSONS.md, linked from skill.md).
// Source of truth stays at the repo root where the distill-lessons skill
// writes them; the copies are gitignored. Missing sources are skipped so a
// bare checkout still builds.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const nextjsDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(nextjsDir, "..", "..");

for (const name of ["LESSONS.md", "ALL-LESSONS.md"]) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) {
    console.warn(`copy-lessons: ${name} not found at repo root, skipping`);
    continue;
  }
  copyFileSync(src, join(nextjsDir, "public", name));
  console.log(`copy-lessons: public/${name} updated`);
}
