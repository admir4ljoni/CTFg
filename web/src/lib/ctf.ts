import { encodeAbiParameters, keccak256, parseAbi, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export const ctfAbi = parseAbi([
  'struct Info { string title; string text; string hint; }',
  'function createChallenge(address flagAddr, uint32 points, Info i) payable returns (uint256)',
  'function count() view returns (uint256)',
  'function info(uint256) view returns (string title, string text, string hint)',
  'function topUp(uint256 id) payable',
  'function submit(uint256 id, bytes sig)',
  'function challenges(uint256) view returns (address flagAddr, uint32 points, uint32 solves, address setter, uint96 bounty)',
  'function solved(uint256, address) view returns (bool)',
  'function score(address) view returns (uint256)',
  'function getPlayers() view returns (address[])',
  'function firstBlood(uint256) view returns (address)',
  'function createInstanceChallenge(uint32 points, bytes initCode, string source, Info i) payable returns (uint256)',
  'function levelSource(uint256) view returns (string)',
  'function deployInstance(uint256 id) returns (address)',
  'function submitInstance(uint256 id)',
  'function instances(uint256, address) view returns (address)',
  'event InstanceDeployed(uint256 indexed id, address indexed player, address instance)',
  'error NotInstance()',
  'error NotSolved()',
  'event ChallengeCreated(uint256 indexed id, address indexed setter, uint32 points)',
  'error Unknown()',
  'error AlreadySolved()',
  'error WrongFlag()',
  'error NotOwner()',
  'error PayFailed()',
  'event BountyAdded(uint256 indexed id, address indexed from, uint256 amount)',
  'event Solved(uint256 indexed id, address indexed player, uint32 points, uint256 bountyPaid, uint256 timestamp)',
])

// flagAddr sentinel for instance challenges, matches CTF.INSTANCE.
export const INSTANCE = '0x0000000000000000000000000000000000000001' as const

export type Info = readonly [title: string, text: string, hint: string]
// Title, text and hint live on-chain in CTF.info, written by the Create form.
export const metaFor = (id: number, info?: Info, instance?: boolean) => ({
  title: info?.[0] || `Challenge #${id}`,
  category: instance ? 'smart contract' : 'flag',
  text: info?.[1] ?? '',
  hint: info?.[2] ?? '',
})

// Flag never leaves the browser. key = keccak256(flag); contract stores only its address.
const flagAccount = (flag: string) => privateKeyToAccount(keccak256(toBytes(flag.trim())))
export const flagAddress = (flag: string) => flagAccount(flag).address
// Must match CTF.submit: keccak256(abi.encode(id, msg.sender)), raw digest, no EIP-191 prefix.
export const signSolve = (flag: string, id: number, player: `0x${string}`) =>
  flagAccount(flag).sign({
    hash: keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }], [BigInt(id), player])),
  })
