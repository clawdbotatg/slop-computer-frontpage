# slop-computer-frontpage

Static front page for the slop.computer podcast. Lists episodes and live status from a mainnet smart contract. Built with Scaffold-ETH 2. Deployable to Vercel, IPFS, and ENS.

See PLAN.md for the full plan and DESIGN.md for the visual system.

## Quickstart (after Phase 1 scaffold)

```bash
yarn install
yarn chain
yarn deploy
yarn start
```

## Three-surface deploy

- Vercel — `vercel deploy --prod`
- IPFS — `yarn ipfs` (pins to BGIPFS, prints CID)
- ENS — set `slopcomputer.eth` contenthash to the new CID

License: MIT.
