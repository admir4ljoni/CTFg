// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice What every instance level must expose. Its constructor takes (address player).
interface ILevel {
    function isSolved() external view returns (bool);
}

/// @title Monad CTF
/// @notice Flag never touches the chain. Setter stores address(keccak256(flag)).
///         Solver signs keccak256(abi.encode(id, msg.sender)) with that key.
contract CTF {
    struct Challenge {
        address flagAddr;
        uint32 points;
        uint32 solves;
        address setter;
        uint96 bounty; // packs with setter
    }

    /// @notice flagAddr sentinel for instance challenges. No key signs for address(1), so submit() can never pass.
    address public constant INSTANCE = address(1);
    uint256 public constant FEE_BPS = 500; // 5% of each bounty payout
    address public immutable owner = msg.sender;
    uint256 public fees;

    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => bool)) public solved;
    mapping(address => uint256) public score;
    // Public RPCs cap eth_getLogs at 100 blocks, so the leaderboard reads these instead of replaying Solved.
    address[] internal players;
    mapping(uint256 => address) public firstBlood;
    mapping(uint256 => mapping(address => address)) public instances;
    // Organizer-supplied level: creation bytecode (deployed per player) and Solidity source (shown to players).
    mapping(uint256 => bytes) public levelCode;
    mapping(uint256 => string) public levelSource;

    event ChallengeCreated(uint256 indexed id, address indexed setter, uint32 points);
    event BountyAdded(uint256 indexed id, address indexed from, uint256 amount);
    event InstanceDeployed(uint256 indexed id, address indexed player, address instance);
    event Solved(uint256 indexed id, address indexed player, uint32 points, uint256 bountyPaid, uint256 timestamp);

    error Exists();
    error Unknown();
    error AlreadySolved();
    error WrongFlag();
    error NotOwner();
    error PayFailed();
    error NotInstance();
    error NotSolved();
    error DeployFailed();

    /// @notice msg.value becomes the bounty, paid to the next solver.
    function createChallenge(uint256 id, address flagAddr, uint32 points) external payable {
        require(uint160(flagAddr) > 1, "flag"); // 0 = unset, 1 = INSTANCE
        _create(id, flagAddr, points);
    }

    /// @notice Instance level. initCode is the level's creation bytecode; its constructor must take (address player).
    function createInstanceChallenge(uint256 id, uint32 points, bytes calldata initCode, string calldata source)
        external
        payable
    {
        require(initCode.length > 0, "code");
        _create(id, INSTANCE, points);
        levelCode[id] = initCode;
        levelSource[id] = source;
    }

    function _create(uint256 id, address flagAddr, uint32 points) internal {
        if (challenges[id].flagAddr != address(0)) revert Exists();
        challenges[id] = Challenge(flagAddr, points, 0, msg.sender, uint96(msg.value));
        emit ChallengeCreated(id, msg.sender, points);
        if (msg.value > 0) emit BountyAdded(id, msg.sender, msg.value);
    }

    function topUp(uint256 id) external payable {
        Challenge storage c = challenges[id];
        if (c.flagAddr == address(0)) revert Unknown();
        c.bounty += uint96(msg.value);
        emit BountyAdded(id, msg.sender, msg.value);
    }

    function withdrawFees() external {
        if (msg.sender != owner) revert NotOwner();
        uint256 f = fees;
        fees = 0;
        (bool ok,) = owner.call{value: f}("");
        if (!ok) revert PayFailed();
    }

    function getPlayers() external view returns (address[] memory) {
        return players;
    }

    function submit(uint256 id, bytes calldata sig) external {
        Challenge storage c = challenges[id];
        if (c.flagAddr == address(0)) revert Unknown();
        if (solved[id][msg.sender]) revert AlreadySolved();
        bytes32 digest = keccak256(abi.encode(id, msg.sender));
        if (ECDSA.recover(digest, sig) != c.flagAddr) revert WrongFlag();

        _solve(id, c);
    }

    function deployInstance(uint256 id) external returns (address inst) {
        if (challenges[id].flagAddr != INSTANCE) revert NotInstance();
        bytes memory code = abi.encodePacked(levelCode[id], abi.encode(msg.sender));
        assembly {
            inst := create(0, add(code, 0x20), mload(code))
        }
        if (inst == address(0)) revert DeployFailed();
        instances[id][msg.sender] = inst;
        emit InstanceDeployed(id, msg.sender, inst);
    }

    function submitInstance(uint256 id) external {
        Challenge storage c = challenges[id];
        if (c.flagAddr != INSTANCE) revert NotInstance();
        if (solved[id][msg.sender]) revert AlreadySolved();
        address inst = instances[id][msg.sender];
        if (inst == address(0) || !ILevel(inst).isSolved()) revert NotSolved();
        _solve(id, c);
    }

    function _solve(uint256 id, Challenge storage c) internal {
        solved[id][msg.sender] = true;
        if (score[msg.sender] == 0) players.push(msg.sender);
        if (c.solves == 0) firstBlood[id] = msg.sender;
        c.solves++;
        score[msg.sender] += c.points;
        // First solver takes the bounty minus fee; later solvers get points only (bounty is 0).
        uint256 b = c.bounty;
        uint256 fee = b * FEE_BPS / 10_000;
        c.bounty = 0;
        fees += fee;
        emit Solved(id, msg.sender, c.points, b - fee, block.timestamp);
        if (b > 0) {
            (bool ok,) = msg.sender.call{value: b - fee}("");
            if (!ok) revert PayFailed();
        }
    }
}
