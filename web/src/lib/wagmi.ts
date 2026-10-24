import { http, webSocket, createConfig, fallback } from 'wagmi'
import { monadTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: fallback([
      webSocket('wss://testnet-rpc.monad.xyz'),
      http('https://testnet-rpc.monad.xyz'),
    ]),
  },
})
