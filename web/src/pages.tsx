import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAccount, useReadContract, useWatchContractEvent, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { BaseError, type EstimateContractGasParameters, formatEther, parseEther, parseEventLogs, type TransactionReceipt } from 'viem'
import { getPublicClient, simulateContract } from 'wagmi/actions'
import { config } from '@/lib/wagmi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CTF_ADDRESS, EXPLORER } from '@/lib/config'
import vaultSource from '@/levels/OpenVault.sol?raw'
import vaultCode from '@/levels/OpenVault.bin?raw'
import { INSTANCE, IDS, MAX_ID, challenges, ctfAbi, flagAddress, metaFor, signSolve } from '@/lib/ctf'

const ctf = { address: CTF_ADDRESS, abi: ctfAbi } as const
// Explicit gas so MetaMask skips eth_estimateGas on the rate-limited public RPC.
// Monad charges by gas limit, so keep these tight: forge reports submit ~182k worst case (first solver, first blood, payout), create ~71k, topUp ~31k.
// submitInstance ~183k. createInstanceChallenge and deployInstance scale with the organizer's bytecode, so those are estimated.
const GAS = { submit: 250_000n, create: 100_000n, topUp: 50_000n, submitInstance: 250_000n }
// Estimate on our RPC with 20% headroom; Monad charges the full limit, so no flat oversized constant.
const estimate = async (req: EstimateContractGasParameters) => ((await getPublicClient(config).estimateContractGas(req)) * 12n) / 10n
const mon = (wei: bigint) => `${formatEther(wei)} MON`

function solvedText(r: TransactionReceipt, points: number) {
  const paid = parseEventLogs({ abi: ctfAbi, eventName: 'Solved', logs: r.logs })[0]?.args.bountyPaid ?? 0n
  return `Solved. +${points} points${paid > 0n ? ` and ${mon(paid)} sent to your wallet` : ''}.`
}

function errText(e: unknown) {
  if (e instanceof BaseError) {
    const m = e.shortMessage
    if (/WrongFlag/.test(e.message)) return 'Wrong flag. Nothing was recorded.'
    if (/AlreadySolved/.test(e.message)) return 'You already solved this one.'
    if (/Unknown/.test(e.message)) return 'This challenge is not on-chain yet.'
    if (/NotSolved/.test(e.message)) return 'Your instance is not solved yet.'
    if (/Exists/.test(e.message)) return 'That id is already taken. Pick another.'
    return m
  }
  return String(e)
}

function TxStatus({ hash, error, pending, success }: { hash?: `0x${string}`; error: unknown; pending: boolean; success?: string | ((r: TransactionReceipt) => string) }) {
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
        {typeof success === 'function' ? success(receipt.data) : success ?? 'Confirmed.'}{' '}
        <a className="underline" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View on explorer</a>
      </p>
    )
  if (hash && (receipt.isError || receipt.data?.status === 'reverted')) return <p className="text-sm text-destructive">Transaction reverted.</p>
  return null
}

export function ChallengeList() {
  const { address } = useAccount()
  const onchain = useReadContracts({
    contracts: IDS.map((id) => ({ ...ctf, functionName: 'challenges', args: [BigInt(id)] } as const)),
  })
  type Row = readonly [string, number, number, string, bigint]
  const rows = IDS.map((id, i) => ({ id, row: onchain.data?.[i]?.result as Row | undefined }))
  // JSON challenges always show; on-chain-only ones show once created.
  const shown = rows.filter(({ id, row }) => challenges.some((c) => c.id === id) || (row && row[0] !== '0x0000000000000000000000000000000000000000'))
  const mine = useReadContracts({
    contracts: shown.map(({ id }) => ({ ...ctf, functionName: 'solved', args: [BigInt(id), address!] } as const)),
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
        {shown.map(({ id, row }, i) => {
          const c = metaFor(id)
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
                    {live && row[4] > 0n && <Badge className="bg-amber-500 text-white">{mon(row[4])} bounty</Badge>}
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
  const c = metaFor(id)
  const { address } = useAccount()
  const [flag, setFlag] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [sigError, setSigError] = useState<unknown>()
  const write = useWriteContract()
  const onchain = useReadContract({ ...ctf, functionName: 'challenges', args: [BigInt(id)] })
  const done = useReadContract({ ...ctf, functionName: 'solved', args: [BigInt(id), address!], query: { enabled: !!address } })
  const live = !!onchain.data && onchain.data[0] !== '0x0000000000000000000000000000000000000000'
  const isInstance = live ? onchain.data![0] === INSTANCE : c.type === 'instance'

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
        {!!onchain.data?.[4] && <> · <span className="font-semibold text-amber-600">{mon(onchain.data[4])} bounty</span> to the next solver</>}
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

      {!isInstance && (
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
            <TxStatus hash={write.data} error={sigError ?? write.error} pending={write.isPending} success={(r) => solvedText(r, onchain.data?.[1] ?? c.points)} />
          </div>
        </form>
      )}
      {isInstance && <InstancePanel id={id} live={live} solved={done.data === true} points={onchain.data?.[1] ?? c.points} />}
    </article>
  )
}

function InstancePanel({ id, live, solved, points }: { id: number; live: boolean; solved: boolean; points: number }) {
  const { address } = useAccount()
  const deploy = useWriteContract()
  const sub = useWriteContract()
  const [simError, setSimError] = useState<unknown>()
  const inst = useReadContract({ ...ctf, functionName: 'instances', args: [BigInt(id), address!], query: { enabled: !!address } })
  const source = useReadContract({ ...ctf, functionName: 'levelSource', args: [BigInt(id)], query: { enabled: live } })
  const addr = inst.data && inst.data !== '0x0000000000000000000000000000000000000000' ? inst.data : undefined

  async function deployIt() {
    setSimError(undefined)
    try {
      const req = { ...ctf, functionName: 'deployInstance', args: [BigInt(id)], account: address } as const
      deploy.writeContract({ ...req, gas: await estimate(req) })
    } catch (err) {
      setSimError(err)
    }
  }

  async function submit() {
    setSimError(undefined)
    try {
      // Dry-run first: an undrained vault reverts here and costs no gas.
      await simulateContract(config, { ...ctf, functionName: 'submitInstance', args: [BigInt(id)], account: address })
      sub.writeContract({ ...ctf, functionName: 'submitInstance', args: [BigInt(id)], gas: GAS.submitInstance })
    } catch (err) {
      setSimError(err)
    }
  }

  return (
    <div className="mt-10 space-y-4">
      {source.data && (
        <div>
          <h3 className="text-sm font-medium">Level source</h3>
          <p className="mt-1 text-xs text-muted-foreground">Stored on-chain by the setter. Every player gets a fresh copy of this contract, deployed with their address as the constructor argument.</p>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md border bg-muted p-4 font-mono text-xs leading-relaxed">{source.data}</pre>
        </div>
      )}
      {addr ? (
        <p className="text-sm">
          Your instance{' '}
          <a className="break-all font-mono text-primary underline" href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer">{addr}</a>
        </p>
      ) : (
        <Button className="h-12 px-5" disabled={!address || !live || deploy.isPending} onClick={deployIt}>
          Deploy my instance
        </Button>
      )}
      <TxStatus hash={deploy.data} error={addr ? undefined : simError ?? deploy.error} pending={deploy.isPending} success="Instance deployed." />
      {addr && (
        <>
          <Button className="h-12 px-5" disabled={solved || sub.isPending} onClick={submit}>{solved ? 'Solved' : 'Submit instance'}</Button>
          <TxStatus hash={sub.data} error={simError ?? sub.error} pending={sub.isPending} success={(r) => solvedText(r, points)} />
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {!live ? 'This challenge is not on-chain yet. Create it from the Create page first.' : address ? 'The contract checks isSolved() on your instance. Exploit it with cast or any wallet, then submit.' : 'Connect MetaMask to play.'}
      </p>
    </div>
  )
}

export function Admin() {
  const { address } = useAccount()
  const [id, setId] = useState('')
  const [points, setPoints] = useState('')
  const [flag, setFlag] = useState('')
  const [bounty, setBounty] = useState('')
  const [topId, setTopId] = useState('')
  const [topAmt, setTopAmt] = useState('')
  const write = useWriteContract()
  const top = useWriteContract()
  const [kindSel, setKind] = useState<'flag' | 'instance'>()
  const [source, setSource] = useState('')
  const [code, setCode] = useState('')
  const [estError, setEstError] = useState<unknown>()
  const kind = kindSel ?? metaFor(Number(id)).type
  const derived = flag ? flagAddress(flag) : undefined
  const codeOk = /^0x([0-9a-fA-F]{2})+$/.test(code.trim())
  const ready = kind === 'instance' ? codeOk && !!source.trim() : !!derived

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setEstError(undefined)
    const value = parseEther(bounty || '0')
    if (kind === 'flag') return write.writeContract({ ...ctf, functionName: 'createChallenge', args: [BigInt(id), derived!, Number(points)], value, gas: GAS.create })
    try {
      const req = { ...ctf, functionName: 'createInstanceChallenge', args: [BigInt(id), Number(points), code.trim() as `0x${string}`, source], value, account: address } as const
      write.writeContract({ ...req, gas: await estimate(req) })
    } catch (err) {
      setEstError(err)
    }
  }

  function topUp(e: React.FormEvent) {
    e.preventDefault()
    top.writeContract({ ...ctf, functionName: 'topUp', args: [BigInt(topId)], value: parseEther(topAmt), gas: GAS.topUp })
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
        <div className="flex gap-2" role="radiogroup" aria-label="Challenge type">
          {(['flag', 'instance'] as const).map((k) => (
            <Button key={k} type="button" role="radio" aria-checked={kind === k} variant={kind === k ? 'default' : 'outline'} onClick={() => setKind(k)}>
              {k === 'flag' ? 'Flag' : 'Smart contract level'}
            </Button>
          ))}
        </div>
        {kind === 'instance' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Each player gets their own copy of your contract. It must have <code className="font-mono">constructor(address player)</code> and <code className="font-mono">isSolved() returns (bool)</code>.{' '}
              <button type="button" className="text-primary underline" onClick={() => { setSource(vaultSource); setCode(vaultCode.trim()) }}>Load example: Open Vault</button>
            </p>
            <div>
              <label htmlFor="src" className="text-sm font-medium">Solidity source (shown to players)</label>
              <textarea id="src" value={source} onChange={(e) => setSource(e.target.value)} rows={10} spellCheck={false} className="mt-1 w-full rounded-md border bg-transparent p-3 font-mono text-xs" placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.20;&#10;contract Level { ... }" />
            </div>
            <div>
              <label htmlFor="code" className="text-sm font-medium">Creation bytecode</label>
              <textarea id="code" value={code} onChange={(e) => setCode(e.target.value)} rows={4} spellCheck={false} className="mt-1 w-full break-all rounded-md border bg-transparent p-3 font-mono text-xs" placeholder="0x6080..." />
              <p className="mt-1 text-xs text-muted-foreground">
                From <code className="font-mono">forge inspect src/Level.sol:Level bytecode</code>, or Remix → Compile → Bytecode → "object" (add 0x).
                {code && !codeOk && <span className="text-destructive"> Must be 0x followed by hex.</span>}
              </p>
            </div>
          </div>
        ) : <div>
          <label htmlFor="aflag" className="text-sm font-medium">Flag</label>
          <Input id="aflag" value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="MONAD{...}" className="mt-1 font-mono" autoComplete="off" spellCheck={false} />
          {derived && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">flag address {derived}</p>}
        </div>}
        <div>
          <label htmlFor="bounty" className="text-sm font-medium">Bounty in MON (optional)</label>
          <Input id="bounty" inputMode="decimal" value={bounty} onChange={(e) => setBounty(e.target.value)} placeholder="0" className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Escrowed in the contract. The first solver receives it minus a 5% platform fee.</p>
        </div>
        {Number(id) >= 1 && Number(id) <= MAX_ID && (
          <p className="text-xs text-muted-foreground">
            Id {id} will appear as “{metaFor(Number(id)).title}”{challenges.some((c) => c.id === Number(id)) ? ' with its text from challenges.json. Use the flag that text describes.' : '.'}
          </p>
        )}
        {Number(id) > MAX_ID && <p className="text-sm text-destructive">Use an id from 1 to {MAX_ID}. Higher ids do not appear in the list.</p>}
        <Button type="submit" disabled={!address || !id || Number(id) < 1 || Number(id) > MAX_ID || !points || !ready || write.isPending}>Create challenge</Button>
        <TxStatus hash={write.data} error={estError ?? write.error} pending={write.isPending} success="Challenge created." />
      </form>

      <h2 className="mt-16 text-3xl font-semibold tracking-tight">Top up a bounty</h2>
      <form onSubmit={topUp} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="tid" className="text-sm font-medium">Challenge id</label>
            <Input id="tid" inputMode="numeric" value={topId} onChange={(e) => setTopId(e.target.value)} placeholder="1" className="mt-1" />
          </div>
          <div>
            <label htmlFor="tamt" className="text-sm font-medium">MON</label>
            <Input id="tamt" inputMode="decimal" value={topAmt} onChange={(e) => setTopAmt(e.target.value)} placeholder="1" className="mt-1" />
          </div>
        </div>
        <Button type="submit" disabled={!address || !topId || !Number(topAmt) || top.isPending}>Add to bounty</Button>
        <TxStatus hash={top.data} error={top.error} pending={top.isPending} success="Bounty added." />
      </form>
    </section>
  )
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function Leaderboard() {
  const { address } = useAccount()
  const qc = useQueryClient()
  const [feed, setFeed] = useState<{ id: number; player: string; points: number; paid: bigint; tx: string }[]>([])
  // Live only: public RPCs cap getLogs at 100 blocks, so history comes from contract storage, not events.
  useWatchContractEvent({
    ...ctf,
    eventName: 'Solved',
    onLogs(logs) {
      const rows = logs.map((l) => ({ id: Number(l.args.id), player: l.args.player!, points: l.args.points!, paid: l.args.bountyPaid!, tx: l.transactionHash }))
      setFeed((f) => [...rows.reverse(), ...f].slice(0, 20))
      qc.invalidateQueries()
    },
  })
  const players = useReadContract({ ...ctf, functionName: 'getPlayers' })
  // A 0-point solve can list a player twice; dedupe here.
  const list = [...new Set(players.data ?? [])]
  const scores = useReadContracts({ contracts: list.map((p) => ({ ...ctf, functionName: 'score', args: [p] } as const)) })
  const bloods = useReadContracts({ contracts: IDS.map((id) => ({ ...ctf, functionName: 'firstBlood', args: [BigInt(id)] } as const)) })
  const bloodCount = (p: string) => bloods.data?.filter((b) => b.result === p).length ?? 0
  const ranked = list
    .map((p, i) => ({ p, score: (scores.data?.[i]?.result as bigint | undefined) ?? 0n }))
    .filter((r) => r.score > 0n)
    .sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0))

  return (
    <section className="grid gap-10 md:grid-cols-[1fr_16rem]">
      <div>
        <h2 className="mb-8 text-3xl font-semibold tracking-tight">Leaderboard</h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">{players.isLoading ? 'Loading…' : 'No solves yet. Be first.'}</p>
        ) : (
          <ol className="divide-y border-y">
            {ranked.map(({ p, score }, i) => (
              <li key={p} className={`grid grid-cols-[2rem_1fr_auto] items-center gap-4 py-3 ${p === address ? 'bg-primary/5' : ''}`}>
                <span className="text-right tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="flex items-center gap-2">
                  <a className="font-mono hover:underline" href={`${EXPLORER}/address/${p}`} target="_blank" rel="noreferrer">{short(p)}</a>
                  {p === address && <Badge variant="secondary">you</Badge>}
                  {bloodCount(p) > 0 && <Badge className="bg-red-600 text-white">{bloodCount(p)} first blood{bloodCount(p) > 1 ? 's' : ''}</Badge>}
                </span>
                <span className="text-xl font-semibold tabular-nums text-primary">{score.toString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <aside>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Live solves</h3>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Watching Monad for new solves…</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {feed.map((f) => (
              <li key={f.tx + f.id}>
                <a className="hover:underline" href={`${EXPLORER}/tx/${f.tx}`} target="_blank" rel="noreferrer">
                  <span className="font-mono">{short(f.player)}</span> solved {metaFor(f.id).title} <span className="text-primary">+{f.points}</span>
                  {f.paid > 0n && <span className="text-amber-600"> · {mon(f.paid)}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </section>
  )
}
