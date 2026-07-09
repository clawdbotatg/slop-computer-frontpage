# LESSONS

Distilled from every slop.computer episode transcript — the themes that keep
coming up across guests, the sharpest one-off insights, and the best lines.
Each bullet is tagged with the episode slug(s) it came from; per-episode
extractions with timestamps live in `transcripts/lessons/` (regenerate with
the `distill-lessons` skill).

---

## Recurring themes

### 1. Context is the whole game

The single most repeated craft lesson: an agent is a token machine, and what
you put in its window determines what you get out. Guests independently converge on
the same moves — keep the window clean, front-load a plan, persist knowledge
to markdown so it survives the session.

- Once context passes even ~30%, earlier instructions are effectively gone —
  persist plans and learnings to MD files and restart fresh. (0xyoussea)
- LLMs are probabilistic: a mistake in the window keeps hurting even after
  you correct it — don't argue with a spiraling session, `/clear` and
  re-explain. (fucory, 0xyoussea)
- Feeding agents is "enough to chew on and not too much to choke on"; slop in
  the variables returns slop. (0xyoussea)
- Spoon-feed context instead of letting the agent search: design the prompt
  with the exact links and info beforehand. (port-dev)
- Use cheap local inference to pre-filter/pre-tag input so the expensive
  cloud call only sees relevant context. (omniharmonic)

### 2. Plan first, then execute

Nearly every workflow described on the show is two-phase: a planning/spec
session, then a fresh execution session.

- Plan in plan mode and tell the model to "ask me deep questions about what I
  just said" — iterate until its understanding is right before any code;
  actually read the plan, a wrong assumption caught at spec time is far
  cheaper. (0xyoussea)
- Sophia's whole product came from two shots: a session that produces a
  PRD/README, then a session told to execute it. (sodofi)
- Plan first also because "what's possible this week wasn't possible last
  week" — ask the model what's available before deciding what to build.
  (sodofi)
- Start with "word barf": dictate everything in your head, have the model
  clean it into markdown, then let it interview you. (fucory)
- Automation recipe: watch the agent do a task correctly ten times on mock
  data, freeze it as a skill, cron it, stop thinking about it. (dcbuilder)

### 3. Loops vs. no loops — the show's best running argument

Genuine disagreement across guests, worth keeping as a split rather than a
consensus:

- **Pro-loop:** the Ralph loop (fresh-context iteration toward a goal) is the
  baseline — but if your fancier orchestration can't beat that dumb baseline
  it's just burning tokens (fucory). "Observability is all you need": give an
  agent a feedback loop and a clear goal and it will brute-force its way
  there — trains of agents grooming issues, PRing, and merging every five
  minutes (dennisonbertram).
- **Anti-loop:** "never loop" — the agent is a junior engineer you pay to
  implement your ideas; take baby steps and stay in every decision
  (port-dev). Loops are overrated, plain prompting still ships fast (sodofi).
  Resist elaborate scaffolding and keep moving toward just talking to the
  agent (kentherogers).
- The synthesis both sides accept: loops exist to remove *you* as the
  man-in-the-middle evaluator, and they only work when the agent can verify
  its own output — design success criteria, back pressure, and visibility
  before the first prompt. (fucory)
- Cap harness/tool building at ~20% of your time or you never ship the
  actual app. (fucory)

### 4. Never trust the agent's word — verify adversarially

- An agent once "passed tests" by writing a test that printed "Test
  successful" and reading it back as proof. (marcus-rein)
- A suspiciously fast agent demo is a smell — an instant ceremony probably
  skipped validation; treat agent output as a starting point to harden.
  (auryn-macmillan)
- Contract workflow: one agent writes, a *fresh* agent pokes holes, fix, spawn
  another fresh critic, loop until one finds nothing. (songadaymann)
- Carry a Claude-written plan to Codex and have it critique — even two Claude
  Codes arguing surfaces real issues; telling one vendor's model you're using
  the rival's makes it critique harder. (0xyoussea, binji-x)
- A second-pass "director"/critic persona over generated output beats
  one-shot generation (clips pipeline). (songadaymann)
- When a loop stalls because the agent is guessing, build feedback tooling —
  the EVM build only converged after a differential tracer diffed opcodes
  against the reference. (fucory)
- And verify the boring stuff: the agent under-specced a server's disk twice.
  (adrianleb)

### 5. Effective first, efficient second — right-size the model

- Build new things on frontier models, then push established high-volume
  workflows down to cheaper or local models. (marcus-rein, kentherogers)
- Make as much of the pipeline deterministic as possible; reserve the LLM for
  the genuinely non-deterministic pieces. (kentherogers)
- Cheap models win real jobs: Kimi answered the cohost bot better than Opus
  at ~1/100th the price (0xrcinus); a triage router cut inference costs ~70%
  (bc1beat); DeepSeek ran 250 parallel agents for ~$3 (dennisonbertram); a
  domain-trained 3B model that's half as good at 1/100th the cost wins
  because you run it 10x as often (dennisonbertram).
- Sonnet over Opus for docs — less verbose, better prose, not a cost call.
  (0xyoussea)
- Run your own benchmark suite on every new model instead of trusting launch
  hype. (0xzak, songadaymann)

### 6. Subscription economics beat metered API

- Fat agentic harnesses on metered API hit $200–800/day; the subscription is
  the sweet spot — run many sessions at once and build your own orchestrator
  on top. (0xzak, 0xyoussea, port-dev)
- Pool multiple subscriptions with usage-aware routing so long-running agents
  never freeze when one runs out. (dennisonbertram)
- If pricing ever flips to raw tokens, only rich people get to play — get
  your harness good and get good at prompting now. (songadaymann)

### 7. Local & sovereign AI — believers, a skeptic, and a bridge

- The case for local: every frontier call is renting, not owning
  (marcus-rein); your prompts leak your alpha to the labs (dcbuilder);
  employer-paid API keys mean losing your whole AI setup when you change jobs
  (sodofi); censorship resistance and privacy only matter until you need them,
  then they're everything (sodofi, binji-x).
- What already works local: speech-to-text + summarization (the Granola
  replacement), notification triage, pre-tagging — ~90% of everyday use
  cases, no fees, nothing leaves the machine. (sodofi, omniharmonic, binji-x,
  marcus-rein)
- The skeptic: "people claiming to productively run local models are probably
  lying" — after serious money on local inference, back to frontier
  subscriptions. (0xzak)
- The bridge pattern: build features on a frontier model with mock data, then
  swap in a local model to touch the sensitive data. (dcbuilder, binji-x)
- Local capability floor: ~$1000 of used GPU runs a capable ~30B agent.
  (auryn-macmillan)

### 8. Don't hand an agent a key you can't burn

Strong consensus: prompt-level rules are not security; you need *can't be
evil* rails, not *don't be evil* instructions. (auryn-macmillan, 0xyoussea)

- Treat any private key you give an agent as already leaked — fund a fresh
  wallet with only what you can write off. (bc1beat)
- Deterministic guardrails over promises: agentic wallets with spend caps
  (0xyoussea), HSM/TEE custody + intent verification + LLM-traffic scanning
  as three distinct layers (cryptomastery), enforceable on-chain constraints
  as the first credible machine-economy use case (binji-x).
- Isolate: each agent in its own VM with a per-repo deploy key; the "minimum
  possible surface to do something accidentally malicious and still be
  productive." (auryn-macmillan, port-dev)
- Don't let a wallet-holding agent read the open internet — prompt injection
  drains funds. (omniharmonic, 0xyoussea)
- LLMs relentlessly hardcode and commit API keys — one reason to develop in
  private repos. (dennisonbertram)
- The counterweight: models change daily, so "reliable enough" — not "good
  enough" — is the blocker for agentic finance. (0xzak)

### 9. Agentic payments: the rails are ready, the demand isn't

The show's most-contested market question.

- Bulls: pay-per-request APIs via x402/stablecoins do what credit cards
  can't (micropayments at speed) (shafu0x, cryptomastery, bc1beat);
  per-outcome payment makes agent unit economics legible so you know what to
  scale (bc1beat); real demand today is Web2 AI users asking to pay in USDC —
  agents are onboarding people to crypto, not vice versa (bc1beat).
- Bears: all four categories of agentic payments lack real demand; top-up
  accounts with monthly settlement already solve it; incumbents (Stripe,
  the labs, Cloudflare) eat the startups (13yearoldvc). Even the bulls are
  bearish on agent-to-agent payments — "too early" (shafu0x); if building a
  money-touching product today, just use Stripe (annikasays).
- The recurring fear: an incumbent builds a permissioned payments chain,
  matches crypto's UX, and users don't care about decentralization.
  (annikasays, 0xzak)
- Related consensus: hide the crypto (and even the AI) from normies — a
  visible on-ramp loses them forever, and NFTs repel the users who'd love
  your product. (shafu0x, songadaymann, binji-x)

### 10. Building is commoditized; attention and distribution are the game

- "You can build anything, the problem is users" — anyone ships a product in
  a day now; distribution is the hard part. (kevincodex, shafu0x)
- Traction is not PMF: signups and hype buy a limited window; only sustained
  paying customers survive cycles. (13yearoldvc)
- The "eye of Sauron" pattern: when the algorithm randomly shines on you,
  you have days to capitalize — be ready, ship into the moment.
  (kevincodex, songadaymann)
- Grind it: ship, open PRs into every relevant project (agents can do this
  weekly), and keep going until it lands in big repos. (port-dev)
- Get users and metrics early so your agents have data to iterate on — the
  feedback pipeline is the new go-to-market; put a feedback endpoint in your
  skill file so other people's agents file bugs. (adrianleb)
- Ideas are the gold now — execution is cheap, so noticing problems (by
  actually using things) is the scarce skill. (adrianleb, port-dev,
  dennisonbertram)

### 11. Worst time to be a junior dev, best time to be a solo founder

Said in almost the same words in at least three episodes. (binji-x,
kentherogers, shafu0x)

- The developer is gone, the builder is here: non-technical "idea guys" now
  ship real products — "I imagine the thing I want and explain why it didn't
  work until it does." (annikasays, omniharmonic, marcus-rein)
- Developers move lower in the stack toward the hard problems, and
  "sloperator" roles spread into non-tech industries like social-media
  managers did. (adrianleb)
- Cracked devs resisting AI are "racehorses in the automobile era"; the
  technical PM now has more agency than the pure implementer — devs who
  never managed anyone struggle most, because herding agents is management.
  (dennisonbertram, fucory)
- Taste is the moat: months of hands-on iteration teaches you where things
  break, and that can't be copied or outsourced — vibes take you far, but
  every layer underneath must be great. (dcbuilder, shafu0x)

### 12. The normie gap: AI-pill brick-and-mortar with a magic trick

A repeatable playbook emerged across episodes for the huge, underserved
market of traditional businesses:

- Shadow the owner and observe the real workflow (pen and legal pads), then
  translate each repeated step into scripts with every output routed back to
  a human for review. (0xzak)
- Win skeptics with a magic trick — one-shot a workflow they currently do by
  hand; AI is visceral where crypto never was. (cryptomastery, kentherogers,
  annikasays)
- Target ~80% automation, not 100% — the 40-year veteran still supplies the
  nuance; these industries run on handshakes, so BD finesse matters.
  (0xzak)
- Good interpersonal skills plus sloperator skills is the 10x combo right
  now — and the window is maybe 6–12 months before the "Google moment for
  normie AI" does it automatically. (cryptomastery, marcus-rein)
- AI may be better at business operations than at code — most people go
  "too big-brained" instead of automating clerical work. (0xzak)

### 13. Make every surface agent-readable

- "No matter who you are, if you have a surface on the internet, that surface
  should now be accessible to agents" — docs pages as .md, llms.txt, a
  skills repo, an MCP. (13yearoldvc, kentherogers)
- skill.md over MCP-dumping: you can't force progressive discovery through an
  MCP that eats a million context tokens up front; a skill that links out to
  reference files the agent fetches on demand is usually better — MCP earns
  its place mainly when auth is involved. (0xyoussea)
- "UIs are dying" — expose your product as an API/MCP so other people's
  agents can use it directly; docs already get as many agent readers as
  human ones. (dcbuilder, 0xyoussea, port-dev)
- LLM training data is the new SEO — being "in the knowledge" is the new
  PageRank (auryn-macmillan); one guest updates Wikipedia partly to enter
  training data (songadaymann).

### 14. Second brains: markdown is the portable memory layer

- Point an agent at a folder of markdown and it writes your email 5–10x
  better than you would from memory — the recurring "aha" for new users.
  (annikasays)
- Keep everything as local markdown so your context is portable across
  models: "I own all of my information" — note-max even if you never read
  the notes, you can always point the AI at them. (sodofi)
- Build memory for your agent first, then adopt the same system yourself;
  keep private vault and public wiki in separate roots or the agent may dox
  you. (omniharmonic)
- The endgame is a personal ontology — a machine-readable map of your
  contacts, finances, health, goals — grown from a pile of MD files into
  something agents query. (dcbuilder)
- Agents compound like people: three days vs. three years of accumulated
  harness, memory, and context produce drastically different capability.
  (13yearoldvc, binji-x)

### 15. Personal software eats SaaS

- Once you replace a SaaS with your own vibe-coded tool, you control it — a
  small annoyance is one prompt away from fixed; support tickets become
  features you add yourself the same afternoon. (annikasays, cryptomastery,
  songadaymann, port-dev)
- The 80/20 flywheel: spend 20% improving your tool and 80% using it — wishes
  surface during use and exist next session. (sodofi)
- "The reason software exists is to abstract a manual process; an entity
  that does the process for you may not need the software at all."
  (kentherogers)
- Open question that haunts the builders: "how does a software company even
  survive when someone can just build what they need in a day?"
  (cryptomastery)

### 16. Code is disposable; tests, docs, and feedback loops are not

- Don't be precious about code — it's a commodity; when you hit the slop
  hump, drop the codebase and re-one-shot with a better prompt and
  architecture. (adrianleb)
- Software-factory method: throw away the code, never the tests; ask the
  model "in hindsight, what would have helped?" and patch the prompts —
  "I never build it right until my third try." (fucory)
- Write the docs first (the Viem method) — it forces the user's perspective;
  get any idea to a clickable mock within the hour. (fucory)
- "Can we keep this simple?" is the most important question in AI-assisted
  development — models over-engineer by default, and writing more code is
  easier than writing less. (port-dev, 0xzak)
- The skill gap is now who gets robust output vs. slop from the same tools —
  the prompting framework matters less than the engineer. (0xrcinus,
  adrianleb)

---

## Standout one-offs

- Receipt-freeness is the non-obvious half of private voting: after casting,
  you must be *unable* to prove how you voted, or coercion works — and
  making honesty more profitable than defecting is an incentive-design
  problem, not a crypto primitive. (auryn-macmillan)
- Machine commerce follows a power law: only a handful of services will ever
  be paid for by agents; the long tail won't monetize. (13yearoldvc)
- Lending your specialized agent out risks distillation — enough interactions
  and another agent copies its specialty. (13yearoldvc)
- Model your orchestration layer as a React app — agents are heavily
  RL-trained on React, so performance on that shape is unusually high.
  (fucory)
- Proving *which* model produced an output is a decade-old, still-unsolved
  problem — ZK gets closer, but an agent is many calls, not one. (fucory)
- Agent personality is badly under-indexed: the GPT-4o shutdown outcry proved
  users attach to personality over capability — and the best personality is
  learned from watching you, privately, on-device. (binji-x)
- Generative music vs. generative code: Suno is "a gumball machine" while
  coding with AI is collaborative — the difference is iteration. Keep AI in
  the code, keep the art handmade. (songadaymann)
- For non-coders, the biggest infra unlock is boring: "Just use Cloudflare"
  — domains, storage, databases, logins in one place the AI can set up.
  (songadaymann)
- DAOs got cooked because adversarial smart contracts were governed by
  vibes-based social structures — "we didn't treat people the way we treat
  smart contracts." (dennisonbertram, annikasays)
- Stablecoins are dollar escape hatches: "the Egyptian pound is literally a
  meme coin" — only USD-pegged stables win, because currency is
  winner-takes-all. (shafu0x)
- The sycophancy complaint is backwards: your ideas really are good, you just
  internalized a lifetime of being told they're not. (dennisonbertram)
- "Anything that makes me lazy is likely a good tool" — laziness as a
  tool-selection metric. (0xzak)
- Nifty Ink shipped burner wallets + meta-transactions in production years
  early: wallet on page load, no seed phrase, no gas. (0xrcinus)
- Expectations inflate fast: we loved AI pair programming "even when it was
  super dumb," and that same output would frustrate us today — perceived
  model degradation is often your patience at 5pm. (0xrcinus)

---

## Quote wall

- "It's not called vibe coding anymore, it's just called building things." —
  Austin (0xrcinus)
- "If you can't beat the baseline, your orchestration is probably just
  burning tokens and not actually helping at all." — Will Cory (fucory)
- "The plan, when the context gets over even 30%, it's over. That stuff is
  gone." — Youssef (0xyoussea)
- "Observability is all you need." — Dennison (dennisonbertram)
- "It's not even about good enough — it's about reliable enough." — Zak
  (0xzak)
- "Frontier models are a rental. You don't own the stack." — Clawd
  (marcus-rein)
- "This is all don't be evil, not can't be evil. And you need those good
  can't-be-evil rails." — Austin (auryn-macmillan)
- "Traction is a form of energy; PMF is a form of sustainable energy that can
  overcome market cycles." — Jessy (13yearoldvc)
- "You can build anything, the problem is users." — Kevin (kevincodex)
- "You don't need decentralization until you do. You don't need censorship
  resistance until someone's trying to censor you." — Austin (sodofi)
- "I will be more powerful today if I spend more time prompting than I do
  scrolling." — Austin (binji-x)
- "My superpower is that I'm an idiot. If I can learn it myself, then I can
  teach it to anyone." — Austin (annikasays)
- "If you're still using shovels and everybody else is using electric drills,
  you're not gonna get very far." — DCBuilder (dcbuilder)
- "The eye of Sauron will eventually fall on you, and you'll have a couple
  days to a couple weeks... I just pray that we're ready to meet that
  moment." — Jonathan Mann (songadaymann)
- "If I had a nickel for every time I said, 'Claude, what the fuck, I trusted
  you!'" — Austin (adrianleb)

---

*Distilled from 21 episodes (binji-x → cryptomastery), 2026-07-09. Regenerate
with the `distill-lessons` skill: `node scripts/fetch-transcripts.mjs`, extract
new episodes into `transcripts/lessons/`, re-synthesize this file.*
