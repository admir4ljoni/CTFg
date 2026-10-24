# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Monad CTF: an on-chain Capture The Flag platform. Players prove solves to a smart contract and the contract pays bounties in MON instantly; organizers escrow prize money up front. Built solo at Monad Blitz Jogja Vol 2 (24 Oct 2026, freeze 16:45 WIB). Full brief, contract design, hour plan, cut list, and demo script are in `PLAN.md`. Read it before any non-trivial task. Scope decisions there are final unless the user changes them.

## Layout

```
contracts/   Foundry project. src/CTF.sol (single contract), src/Vulnerable.sol (instance level), test/CTF.t.sol
web/         Vite + React + TS, wagmi v3 + viem, shadcn + Tailwind, MetaMask injected connector only
Challenge text (title, description, hint) is on-chain in `CTF.info`, written by the Create page. Files go in web/public/files/ and are linked from the description
README.md    must hold live URL, testnet + mainnet addresses, explorer links, run steps
```

No backend, no database. The contract is the data store; the frontend reads events over WebSocket.

## Commands

Contracts (run from `contracts/`):
```sh
forge build
forge test                      # all
forge test --match-test testSubmit -vvv   # one test
forge fmt
```

Web (run from `web/`):
```sh
npm install
npm run dev
npm run build                   # must pass before any deploy
npm run lint
```

Deploy and verify are run by the user only, never by Claude (see Security). Reference:
```sh
forge create src/CTF.sol:CTF --account deployer --rpc-url https://testnet-rpc.monad.xyz --broadcast
forge verify-contract <addr> src/CTF.sol:CTF --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
```
Mainnet: `--account mainnet`, `--rpc-url https://rpc.monad.xyz`, `--chain 143`. Frontend deploys via `vercel` (preview) or `vercel --prod`.

Networks: testnet chain 10143 `https://testnet-rpc.monad.xyz` / `wss://testnet-rpc.monad.xyz`, explorer testnet.monadexplorer.com. Mainnet chain 143 `https://rpc.monad.xyz`.

## Architecture that spans files

- **Flag proof.** Flag never touches the chain. `web/` derives `key = keccak256(flag)` and its address; the setter stores only that address in the contract. A solver signs `keccak256(abi.encode(challengeId, msg.sender))` with the same key; `CTF.submit` recovers the signer with OpenZeppelin ECDSA. The signed message includes the solver's address, which is what prevents mempool copying. Any change to the message layout must be made in both `web/` signing code and `CTF.sol` together.
- **Instances.** `CTF.deployInstance` does `new Vulnerable(msg.sender)`; `CTF.submitInstance` trusts `Vulnerable.isSolved()`. A level is any contract with `constructor(address player)` and `isSolved()`; the Create page uploads its bytecode and source on-chain (`createInstanceChallenge`). Examples live in contracts/src and are copied to web/src/levels.
- **Events are the API.** `Solved`, `ChallengeCreated`, `InstanceDeployed` drive the leaderboard and live feed. Adding UI state usually means adding or extending an event, not adding storage getters.
- **Money.** Bounty rule is first-solver-takes-all minus a constant platform fee. Checks-effects-interactions on every payout. Owner can withdraw only accumulated fees.
- **Contract address** lives in one place in `web/` (a config file); redeploys change only that and the README.

## Git rules

- Commit after every meaningful change with a message that says what and why. Do not batch a session into one commit.
- No `Co-Authored-By` lines. No Claude attribution anywhere in commits or PRs.
- Anything experimental (tournament mode, bounty split rules, new levels, UI rewrites) goes on a branch `exp/<name>`. Merge to `main` only after `forge test` and `npm run build` pass **and** the user explicitly says to merge. Never merge on your own.
- `main` must always build and deploy. Vercel deploys from it.

## Security (from the hackathon workshop, non-negotiable)

- Never ask for, read, or echo a private key, seed phrase, or `.env` with real keys. If one appears in output, stop and tell the user.
- Never run `forge create`, `forge script --broadcast`, `cast send`, or `cast wallet` commands. Print the command and let the user run it. Keys live in Foundry keystores `deployer` (testnet) and `mainnet` only.
- All wallets here are burners. Mainnet key is used once by the user and never by Claude.

## Which skill or plugin to use

| Situation | Use |
|---|---|
| Starting any Monad task, unsure which skill | `monskills:monskill` |
| Scaffolding contracts/ or web/ | `monskills:scaffold` (keep Vite, not Next.js; keep MetaMask, not Para) |
| Writing or editing Solidity, gas limits, estimation | `solidity-lsp` for diagnostics, `monskills:gas` (Monad charges by gas limit, not gas used) |
| Monad behavior that differs from Ethereum (async execution, finality, block states) | `monskills:concepts` |
| Any new page, component, or visual change | `frontend-design:frontend-design` first, then `vercel:shadcn` |
| Reviewing TSX after edits | `vercel:react-best-practices` |
| Deploying, env vars, domain, build failures on Vercel | `vercel:deploy`, `vercel:env`, `vercel:vercel-cli`, `vercel:deployment-expert` agent for stuck builds |
| Event history too slow or need activity feed | `monskills:indexer` (Envio) — post-hackathon only |
| Which RPC, explorer, or provider supports Monad | `monskills:tooling-and-infra` |
| Any code: keep it minimal | `ponytail` is active by default |

Do not use `monskills:wallet` (agent-held wallet) or `monskills:wallet-integration` (Para). Both are out of scope by decision.

## Things that are decided, do not re-raise

- Coin-flip or randomness levels: cut, Monad `prevrandao` is undocumented.
- Tournament mode: default no-go at the 15:15 checkpoint in PLAN.md; never announce it unless deployed and verified.
- Points are static per challenge; first blood is a badge only.
- No upgradeability, no proxy. A bug means redeploy and update one address.
