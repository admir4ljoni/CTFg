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

// Flag never leaves the browser. key = keccak256(flag); contract stores only its address.
const flagAccount = (flag: string) => privateKeyToAccount(keccak256(toBytes(flag.trim())))
export const flagAddress = (flag: string) => flagAccount(flag).address
// Must match CTF.submit: keccak256(abi.encode(id, msg.sender)), raw digest, no EIP-191 prefix.
export const signSolve = (flag: string, id: number, player: `0x${string}`) =>
  flagAccount(flag).sign({
    hash: keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }], [BigInt(id), player])),
  })
