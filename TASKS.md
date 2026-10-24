# TASKS.md

Vertical slices. Each slice is end to end: contract → test → frontend → deploy → verified on the live URL. A slice is done only when the last box is ticked. Do not start the next slice until the current one is deployed, unless the user says so. Commit after each ticked box. Experimental slices (5, 6) go on `exp/<name>` branches.

Times are targets from PLAN.md §10. Freeze 16:45.

## Slice 0 — Skeleton live (target 13:30)
- [x] `contracts/` Foundry project builds (`forge build`), OpenZeppelin installed
- [x] `web/` Vite + React + TS + wagmi v3 + viem + shadcn + Tailwind, wallet connect to Monad Testnet (10143) works locally
- [x] `challenges/challenges.json` with 4 placeholder entries (1 warm-up, 2 crypto/reversing, 1 instance)
- [x] `.gitignore`, `README.md` stub with project name and live URL placeholder
- [x] `vercel link`, first deploy, custom domain + DNS CNAME added (user does DNS)
- [x] Empty site reachable on the custom domain

## Slice 1 — Flag solve pays points (target 14:00 contract, 14:45 UI)
- [x] `CTF.sol`: `createChallenge(id, flagAddr, points)`, `submit(id, sig)` with ECDSA recover of `keccak256(abi.encode(id, msg.sender))`, `score[player]`, `Solved` and `ChallengeCreated` events, double-solve reverts
- [x] `test/CTF.t.sol`: create → sign with flag-derived key → submit → assert score; wrong flag reverts; second submit reverts
- [x] User deploys to testnet, verifies on Sourcify; address written to `web/` config and README
- [x] Web: challenge list reads points/solve count from contract, text from JSON
- [x] Web: challenge detail, flag input → `keccak256(flag)` → sign `(id, address)` → `submit` tx → success/revert toast
- [x] Web: admin page, create challenge (flag → derived address, points)
- [x] Deployed; user solves the warm-up on the live URL and sees score change
- [ ] **Post #1 on X** (tag @monad @monad_dev @geeky_kartikey, verified-contract screenshot)

## Slice 2 — Bounties pay MON per solve (target 14:45)
- [x] `CTF.sol`: `createChallenge` payable (value = bounty), `topUp(id)` payable, first solver receives bounty minus constant platform fee, `withdrawFees()` owner-only, checks-effects-interactions
- [x] Test: bounty lands in solver balance, fee accrues, second solver gets points but no MON
- [x] User redeploys + reverifies testnet; config + README updated
- [x] Web: bounty shown on list and detail; admin top-up; solve toast shows MON received with explorer link
- [x] Deployed; user funds a challenge with 1 MON and solves it from a second wallet on the live URL

## Slice 3 — Leaderboard and live feed (target 14:45)
- [x] Web: leaderboard from `Solved` events (history on load + WebSocket subscription), ranked by score, first-blood badge per challenge
- [x] Web: live feed panel showing solves as they land
- [x] Deployed; two wallets solve, leaderboard reorders without refresh

## Slice 4 — Per-player on-chain instance level (target 15:15)
- [x] `Vulnerable.sol`: reentrancy or access-control bug, constructor takes player, exposes `isSolved()`
- [x] `CTF.sol`: `deployInstance(id)` emits `InstanceDeployed(id, player, addr)`, `submitInstance(id)` checks `isSolved()` then same points/bounty path
- [x] Test: deploy instance → exploit in test → submitInstance succeeds; unsolved instance reverts
- [x] User redeploys + reverifies testnet; config + README updated
- [x] Web: instance challenge shows Deploy My Instance, instance address with explorer link, Submit button; `challenges.json` entry has `type: "instance"`
- [x] Deployed; user deploys an instance, exploits it with `cast`, submits on the live URL
- [x] Create the 4 real challenges on testnet, fund 2 with bounties

## Checkpoint 15:15 — Tournament go/no-go
Default **no-go**. Go only if Slices 0–4 are all ticked and verified. Decision is final.

## Slice 5 — Mainnet, README, media (target 15:40 → 16:05)
- [~] CUT: mainnet deploy (out of time)
- [x] README: live URL, how to run `contracts/` and `web/` from a fresh clone, how to play, how to create a challenge; tested in a fresh clone
- [ ] 30s+ demo video: real solve, payout on explorer, leaderboard moves
- [ ] 15–20s ad video from same footage
- [ ] **Post #2** demo video, **Post #3** ad video

## Slice 6 — Rehearsal and submission (16:05 → 16:40)
- [ ] Pre-stage: funded challenge, fresh demo wallet with 1 MON, instance not yet deployed, two audience phones with 0.5 MON
- [ ] Run the 3-minute demo twice on the live URL without errors
- [ ] Verified badge visible on testnet explorer; README links open in incognito
- [ ] **Submit at blitz.devnads.com** before 16:40
- [ ] 16:40–16:45 change nothing

## Experimental (only on `exp/` branches, only if time) 
- [ ] `exp/tournament`: `createTournament`, `join` payable, `fundTournament`, `finalize` after endTime pays top 3; test; UI. Never announce unless deployed and verified
- [ ] `exp/bounty-split`: first-N or decaying bounty rules
- [ ] `exp/para-login`: email/social login via Para (post-hackathon)
- [ ] `exp/indexer`: Envio indexer replacing event replay (post-hackathon)

## Cut order if behind
Tournament → bounty split → admin UI (use `cast send`) → leaderboard polish → ad video
