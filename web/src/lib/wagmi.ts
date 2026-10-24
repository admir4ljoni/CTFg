import { http, webSocket, createConfig, fallback } from 'wagmi'
import { monadTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Public RPC allows 50 req/s per IP, shared with MetaMask on the same machine.
// Multicall collapses every read into one call; 1s polling keeps the UI live without bursts.
// Wallets that don't have Monad Testnet get it added with Ankr, not the official RPC: MetaMask
// sends the tx through its own RPC, and the official one rate-limits the shared venue IP.
const testnet = { ...monadTestnet, rpcUrls: { default: { http: ['https://rpc.ankr.com/monad_testnet'] } } }

export const config = createConfig({
  chains: [testnet],
  connectors: [injected()],
  batch: { multicall: true },
  pollingInterval: 1_000,
  transports: {
    // Ankr first (no key, broadcast worked from the venue). Official endpoint is 50 req/s per IP
    // and the venue shares one IP. dRPC keeps the WebSocket for event subscriptions.
    [monadTestnet.id]: fallback([
      http('https://rpc.ankr.com/monad_testnet', { batch: true }),
      webSocket('wss://monad-testnet.drpc.org'),
      http('https://testnet-rpc.monad.xyz', { batch: true }),
    ]),
  },
})
