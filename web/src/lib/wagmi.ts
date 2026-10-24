import { http, webSocket, createConfig, fallback } from 'wagmi'
import { monadTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Public RPC allows 50 req/s per IP, shared with MetaMask on the same machine.
// Multicall collapses every read into one call; 1s polling keeps the UI live without bursts.
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  batch: { multicall: true },
  pollingInterval: 1_000,
  transports: {
    [monadTestnet.id]: fallback([
      webSocket('wss://testnet-rpc.monad.xyz'),
      http('https://testnet-rpc.monad.xyz', { batch: true }),
    ]),
  },
})
