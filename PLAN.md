# Monad CTF (repo: CTFg) — Project Brief and Build Plan

Written 13:05 WIB, 24 Oct 2026. Monad Blitz Jogja Vol 2. Submission freeze 16:45. One builder, vibecoding with Claude Code + monskills.

---

## 1. What this is

An on-chain Capture The Flag (CTF) platform. Security people solve challenges, prove the solve to a smart contract, and the contract pays them instantly in MON. Organizers lock prize money up front so nobody has to trust them to pay.

One sentence for the pitch: **"CTF where the prize pool is escrowed and every solve pays out in under a second."**

## 2. Context: the problem

CTF (Capture The Flag) is the standard competition format in cybersecurity. Players solve puzzles (web exploits, cryptography, reverse engineering, smart contract bugs) and submit a secret string, the flag, to a scoreboard. Hundreds of CTFs run every year, including many campus and community events in Indonesia.

What is broken today:

- **Prize payment is manual and slow.** The organizer collects bank details or PayPal, pays weeks or months later, or never. Cross-border payouts for Indonesian winners of international CTFs are a known pain: fees, limits, tax forms, silence.
- **Prizes are promises.** Players compete first and find out later whether the money exists. Small and first-time organizers break this often.
- **Scoreboards are editable.** Admins can delete solves, change timestamps, ban teams after the fact. Disputes are common.
- **Smart contract challenges need infrastructure.** Platforms that host Solidity levels run a Docker launcher plus a private test chain per team. Ethernaut, the main existing on-chain trainer, is single-player, no leaderboard, no prizes, no conventional challenge types.

What this platform does about it:

- Prize money is deposited into the contract before the event. Everyone can see it on the explorer.
- Each solve is checked by the contract and paid by the contract. No human in the loop.
- The scoreboard is computed from solve records nobody can edit.
- Smart contract levels are deployed per player on Monad itself. Zero servers for the organizer. This is only practical on a chain with sub-second finality and near-zero gas, which is the Monad angle.

Honest limit: a trusted brand with a finance team (Google CTF) gains little. The value is for campus clubs, bootcamps, communities, sponsors, and cross-border payouts.

## 3. Who uses it and who pays

| Role | What they do | Money |
|---|---|---|
| Player | Connects wallet, solves, submits | Pays gas only. Receives bounties and tournament prizes. |
| Challenge setter | Creates a challenge, optionally attaches a bounty | Deposits bounty MON |
| Sponsor | Tops up a challenge bounty or tournament pool | Deposits MON |
| Organizer | Creates a tournament with entry fee, end time, split | Collects nothing by hand; contract pays winners |
| Platform (us) | Hosts the site, owns the contract | Takes a small % of pools and bounties (fee constant in contract) |
| Monad | Hosts it all | Developer and security-community onboarding, transactions |

## 4. Functionality (what the website does)

Pages, all one Vite app:

1. **Challenges.** List with title, category, points, bounty left, solve count. Text, hints, and files come from a JSON file in the repo; numbers come from the contract.
2. **Challenge detail.** Flag input, Submit button. For on-chain levels: a Deploy My Instance button and a Submit button.
3. **Leaderboard.** Players ranked by points, first-blood marks, live feed of solves as they happen.
4. **Admin.** Create challenge (enter flag, points, optional bounty), top up a bounty. Create tournament (if built).
5. **Tournament.** Pool size, entry fee, countdown, join button, finalize button after end time (if built).

Two challenge types:

- **Flag-based.** Conventional CTF: crypto, reversing, forensics, misc, anything that ends in a secret string. Solved off-chain, proven on-chain.
- **On-chain instance.** A vulnerable Solidity contract. Player gets their own copy, exploits it, contract checks `isSolved()`.

Scoring: points are static per challenge. First blood is a badge. Money is separate from points: bounties pay per solve, tournaments pay by final rank.

## 5. Web3 functionality (what the contract does)

Single contract `CTF.sol`. Only functions listed here are announced; unannounced features cost nothing, broken announced features cost 25 points.

### 5.1 Flag proof without revealing the flag
- Setter types the flag in the admin page. Browser computes `key = keccak256(flag)`, derives its address, sends only the address to the contract. Flag never leaves the browser, never stored anywhere.
- Player types the flag. Browser derives the same key, signs the message `(challengeId, playerAddress)`, sends the signature.
- Contract recovers the signer with ECDSA (OpenZeppelin). Match means solved. Because the player's own address is inside the signed message, nobody can copy a pending submission from the mempool and claim it.
- Wrong flag: transaction reverts, nothing recorded, player loses gas only.

### 5.2 Points and leaderboard
- `score[player] += points` on each first solve of a challenge per player. Double solve reverts.
- `Solved(challengeId, player, points, bountyPaid, timestamp)` event. Frontend builds the leaderboard from events over WebSocket. No database.

### 5.3 Bounties (money per solve)
- `createChallenge(id, flagAddress, points) payable`: attached MON becomes the bounty.
- `topUp(id) payable`: anyone adds MON.
- Payout rule for today: **first solver takes the whole bounty**, minus platform fee. Split rules (first N, decaying) only if time remains.

### 5.4 Per-player on-chain instances
- `deployInstance(id)`: contract deploys a fresh `Vulnerable` contract owned by the caller, emits `InstanceDeployed(id, player, instanceAddress)`.
- Player exploits it with any tool (cast, Remix, their own contract).
- `submitInstance(id)`: contract calls `instance.isSolved()`; true means solved, same points and bounty path as above.
- Level for today: a reentrancy or access-control bug. Coin-flip level is cut because Monad's `prevrandao` behavior is undocumented.

### 5.5 Tournament (build only if 5.1 to 5.4 are deployed and verified by 14:30)
- `createTournament(entryFee, endTime, split[3])`.
- `join(tournamentId) payable`: entry fee goes into the pool. Sponsors top up with `fundTournament`.
- `finalize(tournamentId)`: reverts before `endTime`. After it, anyone can call. Ranks by points earned during the tournament window, pays top 3 by split, platform keeps fee. Contracts cannot trigger themselves; a button or anyone's call does it.

### 5.6 Security rules kept
- Checks-effects-interactions on every payout.
- Platform fee is a constant, owner can only withdraw accumulated fees, never player pools.
- No upgradeability. Bug means redeploy and change one address.

## 6. Tech stack

| Layer | Choice | Why | Trade-off accepted |
|---|---|---|---|
| Contract | Solidity + Foundry + OpenZeppelin ECDSA | One CLI for compile, test, deploy, verify; verification commands confirmed | Learn forge/cast today |
| Frontend | Vite + React + TypeScript | No server code needed; static deploy in seconds | Deviates from monskills' Next.js default |
| Chain libs | wagmi v3 + viem | Standard hooks, event subscriptions | None |
| UI | shadcn + Tailwind | Looks finished without design time | Setup minutes |
| Wallet | MetaMask via wagmi injected connector | Everyone in the room has it | No email/social login (Para) today |
| Data | Contract events over WebSocket + JSON in repo | No backend, no DB | Slow history after thousands of solves; Envio indexer is the upgrade |
| Hosting | Vercel + custom domain | Logged in; 15 bonus points | None |
| RPC | Public testnet/mainnet endpoints | Free | Rate limits; Alchemy free tier is the fallback |
| Verify | Sourcify on MonadVision | No API key | None |

## 7. Networks and commands

Testnet: chain 10143, `https://testnet-rpc.monad.xyz`, `wss://testnet-rpc.monad.xyz`, explorer `https://testnet.monadexplorer.com`.
Mainnet: chain 143, `https://rpc.monad.xyz`, `wss://rpc.monad.xyz`, explorers monadvision.com, monadscan.com.

Deploy (you run these, password prompt, key never in chat):
```sh
forge create src/CTF.sol:CTF --account deployer --rpc-url https://testnet-rpc.monad.xyz --broadcast
forge verify-contract <addr> src/CTF.sol:CTF --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
```
Mainnet: same two commands with `--account mainnet`, `--rpc-url https://rpc.monad.xyz`, `--chain 143`.

Funds: 20 MON testnet in MetaMask "main". Split: 5 deployer, 6 bounties, 3 to three demo wallets, 6 reserve. Friend buys mainnet MON for the `mainnet` keystore.

## 8. Security rules for vibecoding (from workshop slides)

- Never paste a private key, seed phrase, or .env with real keys into Claude Code.
- Every `forge create`, `cast send`, and verify command is run by you in your terminal.
- Mainnet key only in the `mainnet` keystore, used once, by you.
- Burner wallets only. Anything in MetaMask "main" is testnet.

## 9. Repo layout

```
CTFg/
  contracts/        Foundry project: src/CTF.sol, src/Vulnerable.sol, test/CTF.t.sol
  web/              Vite app
  challenges/       challenges.json (id, title, category, points, text, hints), files/
  README.md         live URL, both contract addresses, explorer links, how to run, how to play
```

## 10. Hour by hour (one builder)

| Time | Do | Done when |
|---|---|---|
| 13:05–13:30 | Clone repo. `/monskills` scaffold: Foundry project + Vite app in one repo. Push. `vercel link`, first deploy of the empty app, add custom domain + DNS CNAME now so it propagates. | Empty site live on your domain. |
| 13:30–14:00 | Contract 5.1–5.3 via Claude Code. One forge test: create challenge, sign with flag key, submit, assert points and balance. Deploy testnet, verify. | Verified badge on testnet explorer. |
| 14:00–14:20 | **Post #1 on X**: what you build, tag @monad @monad_dev @geeky_kartikey, screenshot of verified contract. | Post live. |
| 14:00–14:45 | Frontend: wallet connect, challenge list + detail, flag → key → sign → submit, leaderboard from events, admin create/top-up. Deploy. | You solve a challenge on the live URL and see the bounty land. |
| 14:45–15:15 | Instance level: Vulnerable.sol + deployInstance/submitInstance. Redeploy + reverify testnet. Instance UI. Create 4 real challenges (1 warm-up, 2 crypto/reversing, 1 instance), fund 2 with bounties. | All four solvable from the live site. |
| 15:15 | **Tournament go/no-go.** Default no-go. Only go if everything above is verified and you have 30 spare minutes. | Decision made, not revisited. |
| 15:15–15:40 | Mainnet deploy + verify with `mainnet` keystore. README with live URL, both addresses, explorer links, run instructions. | README complete. |
| 15:40–16:05 | Record 30s+ demo video (real solve, real payout on explorer, leaderboard moves). Cut 15–20s ad from same footage with text overlay. **Post #2** with demo video, **Post #3** ad. | Three posts live. |
| 16:05–16:25 | Rehearse the 3-minute demo twice on the live URL. Pre-stage: challenge funded, fresh demo wallet with 1 MON, instance not yet deployed. Fund two audience phones 0.5 MON each. | Demo runs clean twice. |
| 16:25–16:40 | **Submit at blitz.devnads.com.** Early submission = earlier pitch slot. Check verified badge on both explorers, README links open in incognito. | Submitted. |
| 16:40–16:45 | Buffer. Change nothing. | |

## 11. Cut list (drop in this order if behind)

1. Tournament (never announce if not deployed)
2. Bounty split rules (first-takes-all stays)
3. Admin UI (create challenges with `cast send` instead)
4. Leaderboard polish, first-blood badges
5. Ad video (keep the demo video)

## 12. Demo script (3 minutes)

1. 20s. Problem: CTF prizes are promises, paid manually, slowly, and scoreboards are editable.
2. 60s. Live solve: open challenge, paste flag, sign, submit. Show confirmation in about one second, bounty in wallet on explorer, leaderboard updates.
3. 40s. Instance level: click deploy, personal contract appears instantly, exploit it, submit.
4. 30s. Money: who funds, who gets paid, platform fee. Mainnet address on screen.
5. 30s. Monad: per-player deployments and per-solve payouts only work at sub-second finality and near-zero gas. Next steps: Para login, Envio indexer, tournament mode.

If asked about copying on-chain exploits: "Same as every CTF after a writeup. Flag-based challenges are unaffected, first-blood and decaying points handle the rest."

## 13. Scoring map (400 points)

| Block | Points | How this plan earns them |
|---|---|---|
| Basic | 100 | Public repo, README with URL + addresses, testnet deploy, Vercel hosting |
| Working | 100 | Announce only 5.1–5.4; live tx in demo; Sourcify verified; README run steps tested in a fresh clone |
| Build in public | 100 | 3 posts with tags, 30s+ demo video, ad video; 5K views is luck, do not chase |
| Bonus | 100 | Mainnet deploy 25, custom domain 15, innovation (per-player instances + escrowed per-solve bounties), PMF/revenue (platform fee, sponsored bounties, paid private tournaments) |

Realistic ceiling about 350.

## 14. Known unknowns

- Public RPC rate limits with a room full of users. Fallback: Alchemy free Monad RPC.
- Monad `prevrandao`: undocumented, so no randomness-based levels.
- Exploit visibility on instance levels after first solve. Accepted, stated in pitch.
- Gas: Monad charges by gas limit, not gas used (monskills gas skill). Let wagmi estimate; do not hardcode high limits.
