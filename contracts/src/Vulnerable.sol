// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Open Vault
/// @notice Holds 100 credits for its player. Drain it to zero to solve.
contract Vulnerable {
    address public immutable player;
    address public owner;
    mapping(address => uint256) public credits;

    constructor(address _player) {
        player = _player;
        owner = msg.sender;
        credits[address(this)] = 100;
    }

    /// @dev Bug: no owner check. Anyone can move the vault's credits.
    function withdraw(uint256 amount) external {
        credits[address(this)] -= amount;
        credits[msg.sender] += amount;
    }

    function isSolved() external view returns (bool) {
        return credits[address(this)] == 0;
    }
}
