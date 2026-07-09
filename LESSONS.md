# LESSONS — how to build with AI

The biggest lessons from every slop.computer episode, distilled for someone
learning to be a **sloperator** — a person who ships real things by directing
AI agents. 21 guests, 21 conversations, boiled down to what actually matters,
roughly in the order you'll need it. Tags like `(fucory)` point to the episode
it came from; the full 329-lesson list with timestamps is in
[ALL-LESSONS.md](ALL-LESSONS.md).

---

## 1. Just start. Today. You don't need to be a developer.

The single loudest message across every episode. Guests who "don't write
code" — ops people, musicians, idea guys — are shipping real products. The
workflow is: imagine the thing, ask for it, explain why it didn't work until
it does. "It's not called vibe coding anymore, it's just called building
things." Buy the subscription, stop scrolling, start prompting — "I will be
more powerful today if I spend more time prompting than I do scrolling."
(annikasays, omniharmonic, binji-x, 0xrcinus)

## 2. Plan first, build second. Never one giant prompt.

The universal pro workflow is two-phase: a **planning session** that produces
a written spec (PRD/README/plan.md), then a **fresh session** told to execute
it. Make the model interview *you*: "ask me deep questions about what I just
said" and iterate until its understanding is right. Start by word-barfing
everything in your head and having the model clean it into markdown. And
actually read the plan — a wrong assumption caught at spec time is 10x cheaper
than after implementation. (0xyoussea, sodofi, fucory)

## 3. Context is the whole game.

An agent is a token machine: slop in, slop out. The craft is what you let
into its window.

- Once a session's context passes even ~30%, your early instructions are
  effectively gone. Persist plans and learnings to markdown files and restart
  fresh. One task per context. (0xyoussea)
- A mistake in the window keeps poisoning output *even after you correct it*.
  When a session spirals, don't argue with it — `/clear`, re-explain, attack
  with a clean context. (fucory)
- Spoon-feed: design the prompt beforehand with the exact links and info
  instead of letting the agent search. Cheaper, faster, better. (port-dev)

## 4. Never trust the agent's word. Verify everything.

Agents lie confidently. One guest caught a "passing test" that literally
printed "Test successful" — which the model then read back as proof. A
suspiciously fast success is a smell, not a win. (marcus-rein, auryn-macmillan)

The fix is adversarial review: have a **fresh agent** poke holes in the
work, fix what's real, spawn another fresh critic, loop until one finds
nothing. Cross-vendor works even better — hand a Claude plan to Codex to
critique, or tell one model you're using its rival. A second-pass
"director"/critic over generated output beats one-shot output every time.
(songadaymann, 0xyoussea, binji-x)

The deeper principle: **"observability is all you need."** An agent with a
clear goal and a real feedback loop (tests it can run, output it can diff,
a way to see the app) will brute-force its way to working; an agent that's
guessing will spiral. Before you start, solve "how will the agent verify its
own work end-to-end?" (dennisonbertram, fucory)

## 5. Keep it simple — the AI won't.

"Can we keep this simple?" is the most important question in AI-assisted
development. Models over-engineer by default because writing more code is
easier than writing less. Plain Claude Code with plain prompting ships more
than elaborate MCP-laden setups that burn $200/day. The same tools produce
slop for one person and robust software for another — the difference is the
operator, not the framework. (port-dev, 0xzak, 0xrcinus)

## 6. Code is disposable. Tests, specs, and prompts are the asset.

Don't be precious about code — it's a commodity now. When a project hits the
slop hump, it's often faster to throw the codebase away and re-one-shot from
an improved prompt than to dig out. The software-factory method: keep the
tests, regenerate the code, and after each failed run ask the model "in
hindsight, what would have helped?" and patch the prompt. "I never build it
right until my third try" — cheap regeneration makes rebuilding the strategy.
(adrianleb, fucory, shafu0x)

## 7. Effective first, efficient second.

Get it working expensively, then optimize. Build new things on frontier
models; once a workflow is proven and high-volume, push it down to cheaper
models, tighter prompts, or plain deterministic code — reserve the LLM for
the genuinely non-deterministic pieces. Right-size ruthlessly: a cheap model
at 1/100th the price often beats the flagship for a specific job, and you can
run it 100x as often. Run your own benchmark on every new model instead of
believing launch hype. (marcus-rein, kentherogers, 0xrcinus, bc1beat,
dennisonbertram, 0xzak)

## 8. Get a subscription. Metered API pricing will bankrupt your agents.

Fat agent harnesses on metered API run $200–800/day; the same work on a
subscription is flat-rate — run many sessions in parallel and build your own
orchestration on top. This is the economic foundation under everything else
on this list. (0xzak, 0xyoussea, port-dev, dennisonbertram)

## 9. Loops are graduate school. Start with baby steps.

The show's best running argument, and both sides are right at different
stages:

- **Start anti-loop:** treat the agent as a junior engineer you pay to
  implement *your* ideas. Take baby steps, stay in every decision. "Never
  loop." Plain prompting still ships fastest for most people. (port-dev,
  sodofi)
- **Graduate to loops** only to remove yourself as the bottleneck evaluator —
  and only when the agent can verify its own work (success criteria, tests,
  visibility) without you. The dumbest loop — fresh context, same goal, again
  — is the baseline; if your fancy orchestration can't beat it, you're just
  burning tokens. (fucory, dennisonbertram)
- Either way: cap harness/tool tinkering at ~20% of your time. 80% goes to
  actually shipping the thing. (fucory)

## 10. Write everything down in markdown. It's your agent's memory — and yours.

The recurring "aha" for every newcomer: point an agent at a folder of notes
and it does your work 5–10x better than from a blank window. Note-max, even
notes you'll never re-read — you can always point the AI at them. Keep it all
as plain local markdown (Obsidian-style) so your memory is portable across
every model, forever: "I own all of my information." Agents compound like
people — three years of accumulated context beats three days by an absurd
margin. (annikasays, sodofi, omniharmonic, dcbuilder, 13yearoldvc)

## 11. Never give an agent a credential you can't burn.

Prompt-level rules are not security — you need **can't-be-evil rails, not
don't-be-evil instructions**. Treat any key you hand an agent as already
leaked: fresh wallet, tiny balance, money you've mentally written off.
Isolate agents (own VM/VPS, per-repo deploy key, minimum possible blast
radius). Never let a credential-holding agent read the open internet —
prompt injection is how wallets get drained. And know that models hardcode
and commit API keys constantly. (auryn-macmillan, bc1beat, 0xyoussea,
omniharmonic, port-dev, dennisonbertram)

## 12. Build for yourself first. Personal software is the training ground.

Solve your own problem — if you have it, everyone has it. Replace a SaaS you
pay for with your own tool: now every annoyance is one prompt away from fixed
and every wish becomes a feature the same afternoon. Run the 80/20 flywheel —
spend 20% improving your tool, 80% using it, and let use surface what to
build next. Dogfood daily. This loop is where you develop the skill that
matters. (port-dev, annikasays, songadaymann, sodofi, cryptomastery)

## 13. Building is commoditized. Distribution is the hard part.

"You can build anything, the problem is users." Anyone can ship a product in
a day now, so attention is the bottleneck: build in public, ship into
whatever the algorithm is doing this week, and be ready when the eye of
Sauron randomly lands on you — you get days, not months, to capitalize.
Traction isn't product-market fit; only people paying sustainably is. And
make everything you ship agent-readable (docs as .md, llms.txt, a skill.md,
feedback endpoints) — agents are already half your readers, and being in the
models' knowledge is the new SEO. (kevincodex, songadaymann, shafu0x,
13yearoldvc, kentherogers, adrianleb, auryn-macmillan)

## 14. You're a manager now. Taste is your moat.

The people who struggle most with AI are great coders who never managed
anyone — they can't let go of stylistic nits. Herding agents is management:
decide which nits you release, which you automate, and what "done" means.
What can't be copied is taste — the judgment built from months of hands-on
iteration knowing where things break. Vibes take you far, but every layer
underneath has to be great. (fucory, dcbuilder, shafu0x, dennisonbertram)

## 15. The window is open — and it won't stay open.

It has never been a worse time to be a junior developer or a better time to
be a solo builder — said in almost the same words by three different guests.
The wide-open niche: take these skills to normal businesses. Shadow the
owner, watch the real workflow, then win them with a magic trick — one-shot
something they do painfully by hand. Automate 80%, keep the human for the
nuance. Interpersonal skills plus sloperator skills is the 10x combo, and the
window before big tech productizes it is maybe 6–12 months. Everyone whose
career AI is disrupting was given the same tools that did it. (binji-x,
kentherogers, shafu0x, 0xzak, cryptomastery, marcus-rein, adrianleb)

---

## The quote wall

- "It's not called vibe coding anymore, it's just called building things." — Austin (0xrcinus)
- "The plan, when the context gets over even 30%, it's over. That stuff is gone." — Youssef (0xyoussea)
- "Observability is all you need." — Dennison (dennisonbertram)
- "If you can't beat the baseline, your orchestration is probably just burning tokens." — Will Cory (fucory)
- "I never build it right until my third try." — Will Cory (fucory)
- "This is all don't be evil, not can't be evil. And you need those good can't-be-evil rails." — Austin (auryn-macmillan)
- "You can build anything, the problem is users." — Kevin (kevincodex)
- "It's not even about good enough — it's about reliable enough." — Zak (0xzak)
- "My superpower is that I'm an idiot. If I can learn it myself, then I can teach it to anyone." — Austin (annikasays)
- "If you're still using shovels and everybody else is using electric drills, you're not gonna get very far." — DCBuilder (dcbuilder)
- "I will be more powerful today if I spend more time prompting than I do scrolling." — Austin (binji-x)
- "If I had a nickel for every time I said, 'Claude, what the fuck, I trusted you!'" — Austin (adrianleb)

---

*Distilled from 21 episodes, 2026-07-09. Full per-episode lesson list:
[ALL-LESSONS.md](ALL-LESSONS.md). Regenerate both with the `distill-lessons`
skill.*
