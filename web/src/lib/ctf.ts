import { encodeAbiParameters, keccak256, parseAbi, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import challengesJson from '../../challenges/challenges.json'

export const ctfAbi = parseAbi([
  'function createChallenge(uint256 id, address flagAddr, uint32 points) payable',
  'function topUp(uint256 id) payable',
  'function submit(uint256 id, bytes sig)',
  'function challenges(uint256) view returns (address flagAddr, uint32 points, uint32 solves, address setter, uint96 bounty)',
  'function solved(uint256, address) view returns (bool)',
  'function score(address) view returns (uint256)',
  'event ChallengeCreated(uint256 indexed id, address indexed setter, uint32 points)',
  'error Exists()',
  'error Unknown()',
  'error AlreadySolved()',
  'error WrongFlag()',
  'error NotOwner()',
  'error PayFailed()',
  'event BountyAdded(uint256 indexed id, address indexed from, uint256 amount)',
  'event Solved(uint256 indexed id, address indexed player, uint32 points, uint256 bountyPaid, uint256 timestamp)',
])

export type ChallengeMeta = {
  id: number
  title: string
  category: string
  type: 'flag' | 'instance'
  points: number
  text: string
  hints: string[]
  files: string[]
}
export const challenges = challengesJson as ChallengeMeta[]

// ponytail: public RPCs cap eth_getLogs at 100 blocks, so the list probes ids 1..MAX_ID in one multicall
// instead of replaying ChallengeCreated. Ids above this are invisible; store an id list in the contract to lift it.
export const MAX_ID = 50
export const IDS = Array.from({ length: MAX_ID }, (_, i) => i + 1)
// On-chain challenge with no JSON entry still gets a page so its bounty can be claimed.
export const metaFor = (id: number): ChallengeMeta =>
  challenges.find((c) => c.id === id) ?? {
    id, title: `Challenge #${id}`, category: 'custom', type: 'flag', points: 0,
    text: 'The setter has not published a description for this challenge yet.', hints: [], files: [],
  }

// Flag never leaves the browser. key = keccak256(flag); contract stores only its address.
const flagAccount = (flag: string) => privateKeyToAccount(keccak256(toBytes(flag.trim())))
export const flagAddress = (flag: string) => flagAccount(flag).address
// Must match CTF.submit: keccak256(abi.encode(id, msg.sender)), raw digest, no EIP-191 prefix.
export const signSolve = (flag: string, id: number, player: `0x${string}`) =>
  flagAccount(flag).sign({
    hash: keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }], [BigInt(id), player])),
  })
