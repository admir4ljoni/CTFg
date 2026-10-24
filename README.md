# Monad CTF

On-chain Capture The Flag. Prize pools are escrowed in the contract and every solve pays out in MON in under a second.

Built solo at Monad Blitz Jogja Vol 2, 24 Oct 2026.

## Live

- Site: https://monad-ctf.vercel.app (custom domain pending)
- Contract (Monad Testnet, chain 10143): `0x7012271DdfC4A358F1BA8a916806473E1a944b14` — [explorer](https://testnet.monadexplorer.com/address/0x7012271DdfC4A358F1BA8a916806473E1a944b14)
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
- Challenges (name, description, hint, points, bounty, level source) are created from the site's Create page and stored on-chain; files go in `web/public/files/` and are linked from the description
