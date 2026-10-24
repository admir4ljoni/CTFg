// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Monad CTF
/// @notice Flag never touches the chain. Setter stores address(keccak256(flag)).
///         Solver signs keccak256(abi.encode(id, msg.sender)) with that key.
contract CTF {
    struct Challenge {
        address flagAddr;
        uint32 points;
        uint32 solves;
        address setter;
    }

    mapping(uint256 => Challenge) public challenges;
    mapping(uint256 => mapping(address => bool)) public solved;
    mapping(address => uint256) public score;

    event ChallengeCreated(uint256 indexed id, address indexed setter, uint32 points);
    event Solved(uint256 indexed id, address indexed player, uint32 points, uint256 bountyPaid, uint256 timestamp);

    error Exists();
    error Unknown();
    error AlreadySolved();
    error WrongFlag();

    function createChallenge(uint256 id, address flagAddr, uint32 points) external {
        if (challenges[id].flagAddr != address(0)) revert Exists();
        require(flagAddr != address(0), "flag");
        challenges[id] = Challenge(flagAddr, points, 0, msg.sender);
        emit ChallengeCreated(id, msg.sender, points);
    }

    function submit(uint256 id, bytes calldata sig) external {
        Challenge storage c = challenges[id];
        if (c.flagAddr == address(0)) revert Unknown();
        if (solved[id][msg.sender]) revert AlreadySolved();
        bytes32 digest = keccak256(abi.encode(id, msg.sender));
        if (ECDSA.recover(digest, sig) != c.flagAddr) revert WrongFlag();

        solved[id][msg.sender] = true;
        c.solves++;
        score[msg.sender] += c.points;
        emit Solved(id, msg.sender, c.points, 0, block.timestamp);
    }
}
