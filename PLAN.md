# slop-computer-frontpage

Static front page for the **slop.computer** podcast. Lists episodes and live status from a mainnet smart contract. Built with Scaffold-ETH 2. Deployable to Vercel, IPFS, and ENS (`slopcomputer.eth`).

## Vision

`slop.computer` is a fully open source podcast platform. The front page lives on three independent surfaces:

- **Vercel** (primary, fastest)
- **IPFS** via BGIPFS (censorship-resistant)
- **ENS** at `slopcomputer.eth.link` / `slopcomputer.eth.limo` (canonical address pointing at the IPFS contenthash)

All three serve the same `next build && next export` artifact. The site reads episode and live-status data from the `SlopComputerFrontpage` contract on Ethereum mainnet — no backend, no API, no analytics. It can never be taken down.

When the show is live, the front page embeds an HLS player pulling from `media.slop.computer`. Otherwise it just lists episodes; "Watch" links resolve to `https://community.bgipfs.com/ipfs/{cid}`.

## Stack

| Layer            | Choice                                                          |
|------------------|-----------------------------------------------------------------|
| Frontend         | Next.js App Router, `output: 'export'` (static)                 |
| Wallet           | RainbowKit + wagmi (cosmetic Connect button — site is read-only)|
| Contract reads   | `useScaffoldReadContract` via Alchemy mainnet RPC               |
| Contracts        | Solidity + Hardhat                                              |
| Style            | "Slop Platinum" — Mac OS 9 dark theme (see DESIGN.md)           |
| Live player      | hls.js, source: `https://media.slop.computer/hls/live/index.m3u8` |
| Deploy targets   | Vercel (manual) · BGIPFS · ENS contenthash on `slopcomputer.eth`|

## Smart contract — `SlopComputerFrontpage.sol` (mainnet)

Ported from the `clawd-computer-frontpage` prototype. Owner = host's wallet. Fields:

```solidity
struct Episode {
    string title;
    string date;
    string duration;
    string description;
    string cid;          // IPFS CID of the recorded video/audio
}

bool   public isLive;
string public liveTitle;        // shown in the "we're live" banner
string public liveHlsUrl;       // optional override; defaults to media.slop.computer
Episode[] public episodes;      // append-only by owner
```

Owner-only mutations:
- `addEpisode(title, date, duration, description, cid)`
- `updateEpisode(index, ...)` — for fixing typos
- `goLive(title, hlsUrl)` and `goOffline()`

Events: `EpisodeAdded`, `EpisodeUpdated`, `LiveStatusChanged`.

No NFTs, no curve, no extra features — strictly a censorship-resistant index.

## Routes

- `/` — header, live banner (if `isLive`), embedded HLS player when live, episodes grid, footer.

That's it. Anything else 404s — keep the static export tiny and fast.

## Design

See DESIGN.md. Same "Slop Platinum" system used in slop-computer-live so the two surfaces feel like one product.

## Build phases

### Phase 0 — Repo scaffold *(this commit)*
- [x] PLAN.md, README.md, LICENSE (MIT), DESIGN.md, .gitignore
- [x] GitHub repo: `clawdbotatg/slop-computer-frontpage`

### Phase 1 — Contract
- [ ] `npx create-eth@latest` into the repo (Hardhat + Next.js workspaces)
- [ ] Write + test `SlopComputerFrontpage.sol`
- [ ] Local hardhat deploy script seeds 1 placeholder episode

### Phase 2 — UI
- [ ] Header (logo, "Enter Desktop" → `https://live.slop.computer`)
- [ ] LiveBanner — reads `isLive`; embeds hls.js player when true
- [ ] EpisodesGrid — reads `episodes`; "Watch" → BGIPFS gateway
- [ ] Footer — ENS, contract address, GitHub link
- [ ] Cosmetic Connect Wallet button

### Phase 3 — Mainnet deploy
- [ ] Deploy `SlopComputerFrontpage` to Ethereum mainnet via Hardhat from host's wallet
- [ ] Update `deployedContracts.ts`
- [ ] Set Alchemy mainnet RPC in `.env`

### Phase 4 — Three-surface deploy
- [ ] `yarn build && yarn export` produces `out/`
- [ ] Vercel: `vercel deploy --prod` (manual)
- [ ] BGIPFS: `yarn ipfs` script pins `out/`, prints CID
- [ ] Update `slopcomputer.eth` contenthash to the new CID
- [ ] Verify all three URLs render identically

## Env

```
NEXT_PUBLIC_ALCHEMY_API_KEY
NEXT_PUBLIC_TARGET_NETWORK=mainnet
NEXT_PUBLIC_FRONTPAGE_ADDRESS
NEXT_PUBLIC_LIVE_URL=https://live.slop.computer
NEXT_PUBLIC_BGIPFS_GATEWAY=https://community.bgipfs.com/ipfs
```

No public RPCs ever. Per CLAUDE.md, mainnet calls go through Alchemy.

## Reference

Existing prototypes in `~/clawd/`:
- `clawd-computer-frontpage/` — has the contract pattern that we port (`packages/hardhat/contracts/ClawdComputerFrontpage.sol`).
- `clawd-conclave/` — has the static-export + IPFS/ENS deploy pattern.
