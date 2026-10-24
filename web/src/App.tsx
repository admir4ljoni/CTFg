import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { monadTestnet } from 'wagmi/chains'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ConnectButton() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  if (!isConnected)
    return (
      <Button onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>
        {isPending ? 'Connecting…' : 'Connect MetaMask'}
      </Button>
    )
  if (chainId !== monadTestnet.id)
    return (
      <Button variant="destructive" onClick={() => switchChain({ chainId: monadTestnet.id })}>
        Switch to Monad Testnet
      </Button>
    )
  return (
    <Button variant="outline" onClick={() => disconnect()}>
      {address!.slice(0, 6)}…{address!.slice(-4)}
    </Button>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Monad CTF</h1>
        <ConnectButton />
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Escrowed prize pools. Every solve pays out on-chain in under a second.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
