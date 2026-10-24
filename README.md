# Monad CTF

On-chain Capture The Flag. Prize pools are escrowed in the contract and every solve pays out in MON in under a second.

Built solo at Monad Blitz Jogja Vol 2, 24 Oct 2026.

## Live

- Site: https://midratama.my.id (also https://monad-ctf.vercel.app)
- Contract (Monad Testnet, chain 10143): `0x260b6bfB91531E8b3Ad83dE2cdEae978FbC4e112` — [explorer](https://testnet.monadexplorer.com/address/0x260b6bfB91531E8b3Ad83dE2cdEae978FbC4e112)

## How it works

- **Flag challenges.** The flag never goes on-chain. The organizer's browser turns the flag into a private key (`keccak256(flag)`) and stores only its address. A solver signs `(challengeId, their address)` with that key and the contract checks the signature. Because the signature includes the solver's address, copying someone's transaction from the mempool doesn't work.
- **Smart-contract challenges.** The organizer uploads a level's bytecode and source. Each player deploys a personal copy, exploits it, and the contract checks `isSolved()`.
- **Bounties.** The first solver of a funded challenge gets the bounty minus a 5% platform fee, paid in the same transaction. Later solvers get points only.
- **Leaderboard and feed** are built from contract events. There is no backend.

## Play

1. Open the site, click **Connect MetaMask** and switch to Monad Testnet. Get test MON from the [faucet](https://faucet.monad.xyz).
2. Pick a challenge. Flag challenges: find the flag, paste it, hit Submit. Smart-contract challenges: **Deploy my instance**, read the source, exploit your copy (e.g. with `cast`), then **Submit instance**.
3. Bounty arrives in your wallet on the solve. Check the **Leaderboard**.

## Create a challenge

Open **Create** on the site.

- **Flag:** name, description, optional hint, points, optional bounty in MON, and the flag (e.g. `MONAD{...}`). The bounty is sent with the create transaction and held by the contract.
- **Smart contract:** same fields plus the level's Solidity source and creation bytecode. A level is any contract with `constructor(address player)` and `isSolved() returns (bool)`. Use the **Open Vault** / **Private Locker** loaders for examples (`contracts/src/`). Get bytecode with `forge inspect src/MyLevel.sol:MyLevel bytecode`.
- **Top up a bounty** for any existing challenge from the same page.
- Files for a challenge go in `web/public/files/` and are linked from the description.

## Run from a fresh clone

Needs [Foundry](https://getfoundry.sh) and Node 20+. Dependencies under `contracts/lib/` are committed, no submodule step.

```sh
git clone https://github.com/admir4ljoni/CTFg.git && cd CTFg

# contracts
cd contracts && forge build && forge test && cd ..

# web (points at the testnet contract in web/src/lib/config.ts)
cd web && npm install && npm run dev
```

### Deploy your own

```sh
cd contracts
forge create src/CTF.sol:CTF --account <keystore> --rpc-url https://testnet-rpc.monad.xyz --broadcast
forge verify-contract <addr> src/CTF.sol:CTF --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/
```

Put the new address in `web/src/lib/config.ts`.

## Layout

- `contracts/` Foundry: `src/CTF.sol`, example levels `src/Vulnerable.sol` and `src/PrivateLocker.sol`, `test/CTF.t.sol`
- `web/` Vite + React + wagmi + shadcn, MetaMask only
