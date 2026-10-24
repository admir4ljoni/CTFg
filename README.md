# Monad CTF

On-chain Capture The Flag. Prize pools are escrowed in the contract and every solve pays out in MON in under a second.

Built solo at Monad Blitz Jogja Vol 2, 24 Oct 2026.

## Live

- Site: https://monad-ctf.vercel.app (custom domain pending)
- Contract (Monad Testnet, chain 10143): `0x57C03B3fe5674efBc903E7261beC4DF3856c07C6` — [explorer](https://testnet.monadexplorer.com/address/0x57C03B3fe5674efBc903E7261beC4DF3856c07C6)
- Contract (Monad Mainnet, chain 143): _TBD_

## Run

```sh
# contracts
cd contracts && forge build && forge test

# web
cd web && npm install && npm run dev
```

## Layout

- `contracts/` Foundry: `src/CTF.sol`, `src/Vulnerable.sol`, `test/CTF.t.sol`
- `web/` Vite + React + wagmi, MetaMask only
- `web/challenges/` challenge text; files in `web/public/files/`; points and solves come from the contract
