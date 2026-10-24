import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { monadTestnet } from 'wagmi/chains'
import { Button } from '@/components/ui/button'
import { Admin, ChallengeDetail, ChallengeList } from '@/pages'

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
    <Button variant="outline" onClick={() => disconnect()} className="font-mono">
      {address!.slice(0, 6)}…{address!.slice(-4)}
    </Button>
  )
}

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const detail = hash.match(/^#\/c\/(\d+)/)
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <nav className="flex items-baseline gap-6">
          <a href="#/" className="text-xl font-semibold tracking-tight">Monad CTF</a>
          <a href="#/admin" className="text-sm text-muted-foreground hover:text-foreground">Create</a>
        </nav>
        <ConnectButton />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        {detail ? <ChallengeDetail id={Number(detail[1])} /> : hash === '#/admin' ? <Admin /> : <ChallengeList />}
      </main>
    </div>
  )
}
