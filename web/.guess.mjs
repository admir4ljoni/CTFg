import { keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
const target = '0x23Ecf4eB001f92EAA600608E7a4f231D3de54357'.toLowerCase()
const keys = 'adsw'; let n = 0; const t0 = Date.now()
function* gen(len, pre = '') { if (!len) { yield pre; return } for (const k of keys) yield* gen(len - 1, pre + k) }
for (let L = 1; L <= 8; L++) for (const s of gen(L)) for (const f of [s, s.toUpperCase(), `MONAD{${s}}`, `MONAD{${s.toUpperCase()}}`]) {
  n++
  if (privateKeyToAccount(keccak256(toBytes(f))).address.toLowerCase() === target) { console.log('FOUND:', JSON.stringify(f), n); process.exit(0) }
}
console.log('no match', n, 'tried in', (Date.now() - t0) / 1000, 's')
