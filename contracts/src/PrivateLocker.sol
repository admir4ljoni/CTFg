// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Private Locker
/// @notice Guess the password to unlock. It is private, so nobody can read it. Right?
contract PrivateLocker {
    address public immutable player;
    bytes32 private password;
    bool public unlocked;

    constructor(address _player) {
        player = _player;
        password = keccak256(abi.encode(_player, block.timestamp, address(this)));
    }

    function unlock(bytes32 guess) external {
        require(guess == password, "wrong password");
        unlocked = true;
    }

    function isSolved() external view returns (bool) {
        return unlocked;
    }
}
