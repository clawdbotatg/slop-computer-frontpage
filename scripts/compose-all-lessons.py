#!/usr/bin/env python3
"""Compose ALL-LESSONS.md — every lesson bullet from every per-episode
extraction (transcripts/lessons/<slug>.md), one flat list, oldest episode
first. Run after the distill-lessons extraction pass:

    python3 scripts/compose-all-lessons.py
"""
import datetime
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
idx = json.load(open(os.path.join(ROOT, "transcripts/index.json")))
eps = sorted(idx.values(), key=lambda e: e["datetime"])

out = [
    "# ALL LESSONS",
    "",
    "Every lesson extracted from every slop.computer episode, one list, oldest",
    "episode first. Attribution and ~timestamps point into that episode's",
    "transcript. Distilled cross-episode themes live in [LESSONS.md](LESSONS.md);",
    "regenerate both with the `distill-lessons` skill.",
    "",
]

total = 0
for e in eps:
    path = os.path.join(ROOT, "transcripts/lessons", f"{e['slug']}.md")
    if not os.path.exists(path):
        continue
    m = re.search(r"### Lessons\n(.*?)(?=\n### |\Z)", open(path).read(), re.S)
    if not m:
        continue
    bullets = [l for l in m.group(1).strip().splitlines() if l.strip().startswith("-")]
    total += len(bullets)
    meta = e.get("meta") or {}
    title = meta.get("title") or e["name"]
    date = datetime.datetime.utcfromtimestamp(e["datetime"]).strftime("%Y-%m-%d")
    out += [f"## {title} — `{e['slug']}` ({date})", "", *bullets, ""]

today = datetime.date.today().isoformat()
out += ["---", "", f"*{total} lessons across {len(eps)} episodes, extracted {today}.*"]
open(os.path.join(ROOT, "ALL-LESSONS.md"), "w").write("\n".join(out) + "\n")
print(f"ALL-LESSONS.md: {total} lessons across {len(eps)} episodes")
