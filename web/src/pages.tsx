import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { BaseError } from 'viem'
import { simulateContract } from 'wagmi/actions'
import { config } from '@/lib/wagmi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CTF_ADDRESS, EXPLORER } from '@/lib/config'
import { challenges, ctfAbi, flagAddress, signSolve } from '@/lib/ctf'

const ctf = { address: CTF_ADDRESS, abi: ctfAbi } as const
// Explicit gas so MetaMask skips eth_estimateGas on the rate-limited public RPC.
// Monad charges by gas limit, so keep these tight: forge reports submit ~113k, create ~71k.
const GAS = { submit: 150_000n, create: 100_000n }

function errText(e: unknown) {
  if (e instanceof BaseError) {
    const m = e.shortMessage
    if (/WrongFlag/.test(e.message)) return 'Wrong flag. Nothing was recorded.'
    if (/AlreadySolved/.test(e.message)) return 'You already solved this one.'
    if (/Unknown/.test(e.message)) return 'This challenge is not on-chain yet.'
    return m
  }
  return String(e)
}

function TxStatus({ hash, error, pending, success }: { hash?: `0x${string}`; error: unknown; pending: boolean; success?: string }) {
  const receipt = useWaitForTransactionReceipt({ hash })
  const qc = useQueryClient()
  useEffect(() => { if (receipt.isSuccess) qc.invalidateQueries() }, [receipt.isSuccess, qc])
  if (error) return <p className="text-sm text-destructive">{errText(error)}</p>
  if (pending) return <p className="text-sm text-muted-foreground">Confirm in MetaMask…</p>
  if (hash && receipt.isLoading) return <p className="text-sm text-muted-foreground">Waiting for Monad…</p>
  if (hash && receipt.data?.status === 'reverted') return <p className="text-sm text-destructive">Transaction reverted.</p>
  if (hash && receipt.isSuccess)
    return (
      <p className="text-sm text-emerald-700">
        {success ?? 'Confirmed.'}{' '}
        <a className="underline" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View on explorer</a>
      </p>
    )
  if (hash && (receipt.isError || receipt.data?.status === 'reverted')) return <p className="text-sm text-destructive">Transaction reverted.</p>
  return null
}

export function ChallengeList() {
  const { address } = useAccount()
  const onchain = useReadContracts({
    contracts: challenges.map((c) => ({ ...ctf, functionName: 'challenges', args: [BigInt(c.id)] })),
  })
  const mine = useReadContracts({
    contracts: challenges.map((c) => ({ ...ctf, functionName: 'solved', args: [BigInt(c.id), address!] })),
    query: { enabled: !!address },
  })
  const score = useReadContract({ ...ctf, functionName: 'score', args: [address!], query: { enabled: !!address } })

  return (
    <section>
      <div className="mb-8 flex items-baseline justify-between">
        <h2 className="text-3xl font-semibold tracking-tight">Challenges</h2>
        {address && (
          <p className="text-sm text-muted-foreground">
            Your score <span className="font-semibold text-foreground tabular-nums">{score.data?.toString() ?? '0'}</span>
          </p>
        )}
      </div>
      <ol className="divide-y border-y">
        {challenges.map((c, i) => {
          const row = onchain.data?.[i]?.result as readonly [string, number, number, string] | undefined
          const live = row && row[0] !== '0x0000000000000000000000000000000000000000'
          const done = mine.data?.[i]?.result === true
          return (
            <li key={c.id}>
              <a href={`#/c/${c.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 hover:bg-primary/5 -mx-3 px-3 rounded-md transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.title}</span>
                    <Badge variant="secondary">{c.category}</Badge>
                    {done && <Badge className="bg-emerald-600 text-white">solved</Badge>}
                    {!live && <Badge variant="outline">not deployed</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {live ? `${row[2]} solve${row[2] === 1 ? '' : 's'}` : 'Waiting for the setter'}
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-2xl font-semibold text-primary">{live ? row[1] : c.points}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function ChallengeDetail({ id }: { id: number }) {
  const c = challenges.find((x) => x.id === id)
  const { address } = useAccount()
  const [flag, setFlag] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [sigError, setSigError] = useState<unknown>()
  const write = useWriteContract()
  const onchain = useReadContract({ ...ctf, functionName: 'challenges', args: [BigInt(id)] })
  const done = useReadContract({ ...ctf, functionName: 'solved', args: [BigInt(id), address!], query: { enabled: !!address } })
  if (!c) return <p>No such challenge.</p>
  const live = !!onchain.data && onchain.data[0] !== '0x0000000000000000000000000000000000000000'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!address) return
    setSigError(undefined)
    try {
      const sig = await signSolve(flag, id, address)
      // Dry-run on our RPC first: a wrong flag reverts here and costs no gas.
      await simulateContract(config, { ...ctf, functionName: 'submit', args: [BigInt(id), sig], account: address })
      write.writeContract({ ...ctf, functionName: 'submit', args: [BigInt(id), sig], gas: GAS.submit })
    } catch (err) {
      setSigError(err)
    }
  }

  return (
    <article className="max-w-2xl">
      <a href="#/" className="text-sm text-muted-foreground hover:text-foreground">← All challenges</a>
      <div className="mt-4 flex items-baseline gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">{c.title}</h2>
        <Badge variant="secondary">{c.category}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground tabular-nums">
        {onchain.data?.[1] ?? c.points} points · {onchain.data?.[2] ?? 0} solves
      </p>
      <p className="mt-6 whitespace-pre-wrap leading-relaxed">{c.text}</p>
      {c.files.length > 0 && (
        <ul className="mt-4 text-sm">
          {c.files.map((f) => (
            <li key={f}><a className="text-primary underline" href={`/files/${f}`} download>{f}</a></li>
          ))}
        </ul>
      )}
      {c.hints.length > 0 && (
        <div className="mt-4 text-sm">
          {showHint ? <p className="text-muted-foreground">Hint: {c.hints[0]}</p> : <button className="text-muted-foreground underline" onClick={() => setShowHint(true)}>Show hint</button>}
        </div>
      )}

      {c.type === 'flag' && (
        <form onSubmit={submit} className="mt-10">
          <label htmlFor="flag" className="text-sm font-medium">Flag</label>
          <div className="mt-2 flex gap-2">
            <Input id="flag" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="MONAD{...}" className="h-12 font-mono text-base" autoComplete="off" spellCheck={false} disabled={done.data === true} />
            <Button type="submit" className="h-12 px-5" disabled={!address || !flag || !live || write.isPending || done.data === true}>
              {done.data ? 'Solved' : 'Submit flag'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {!live ? 'This challenge is not on-chain yet. Create it from the Create page first.' : address ? 'Your flag is signed locally and never sent anywhere. Only the signature goes on-chain.' : 'Connect MetaMask to submit.'}
          </p>
          <div className="mt-3">
            <TxStatus hash={write.data} error={sigError ?? write.error} pending={write.isPending} success={`Solved. +${onchain.data?.[1] ?? c.points} points.`} />
          </div>
        </form>
      )}
      {c.type === 'instance' && <p className="mt-10 text-sm text-muted-foreground">Instance challenges arrive in the next release.</p>}
    </article>
  )
}

export function Admin() {
  const { address } = useAccount()
  const [id, setId] = useState('')
  const [points, setPoints] = useState('')
  const [flag, setFlag] = useState('')
  const write = useWriteContract()
  const derived = flag ? flagAddress(flag) : undefined

  function create(e: React.FormEvent) {
    e.preventDefault()
    write.writeContract({ ...ctf, functionName: 'createChallenge', args: [BigInt(id), derived!, Number(points)], gas: GAS.create })
  }

  return (
    <section className="max-w-xl">
      <h2 className="text-3xl font-semibold tracking-tight">Create a challenge</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The flag is hashed in your browser. The contract only ever sees the address derived from it.
      </p>
      <form onSubmit={create} className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="id" className="text-sm font-medium">Challenge id</label>
            <Input id="id" inputMode="numeric" value={id} onChange={(e) => setId(e.target.value)} placeholder="1" className="mt-1" />
          </div>
          <div>
            <label htmlFor="points" className="text-sm font-medium">Points</label>
            <Input id="points" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="100" className="mt-1" />
          </div>
        </div>
        <div>
          <label htmlFor="aflag" className="text-sm font-medium">Flag</label>
          <Input id="aflag" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="MONAD{...}" className="mt-1 font-mono" autoComplete="off" spellCheck={false} />
          {derived && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">flag address {derived}</p>}
        </div>
        <Button type="submit" disabled={!address || !id || !points || !flag || write.isPending}>Create challenge</Button>
        <TxStatus hash={write.data} error={write.error} pending={write.isPending} success="Challenge created." />
      </form>
    </section>
  )
}
