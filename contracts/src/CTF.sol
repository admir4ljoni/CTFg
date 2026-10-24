// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Slice 0 stub: proves the OZ remapping compiles. Real contract lands in Slice 1.
contract CTF {
    using ECDSA for bytes32;

    function recover(bytes32 hash, bytes calldata sig) external pure returns (address) {
        return hash.recover(sig);
    }
}
