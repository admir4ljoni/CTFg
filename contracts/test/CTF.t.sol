// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CTF} from "../src/CTF.sol";

contract CTFTest is Test {
    CTF ctf;
    uint256 flagKey = uint256(keccak256("MONAD{test}"));
    address flagAddr = vm.addr(flagKey);
    address player = makeAddr("player");

    function setUp() public {
        ctf = new CTF();
        ctf.createChallenge(1, flagAddr, 100);
    }

    function sign(uint256 key, uint256 id, address who) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encode(id, who)));
        return abi.encodePacked(r, s, v);
    }

    function testSubmit() public {
        vm.prank(player);
        ctf.submit(1, sign(flagKey, 1, player));
        assertEq(ctf.score(player), 100);
        (,, uint32 solves,) = ctf.challenges(1);
        assertEq(solves, 1);
    }

    function testWrongFlagReverts() public {
        bytes memory sig = sign(uint256(keccak256("MONAD{wrong}")), 1, player);
        vm.prank(player);
        vm.expectRevert(CTF.WrongFlag.selector);
        ctf.submit(1, sig);
    }

    function testStolenSigReverts() public {
        bytes memory sig = sign(flagKey, 1, player); // signed for player
        vm.prank(makeAddr("thief"));
        vm.expectRevert(CTF.WrongFlag.selector);
        ctf.submit(1, sig);
    }

    function testDoubleSolveReverts() public {
        bytes memory sig = sign(flagKey, 1, player);
        vm.startPrank(player);
        ctf.submit(1, sig);
        vm.expectRevert(CTF.AlreadySolved.selector);
        ctf.submit(1, sig);
    }

    function testDuplicateIdReverts() public {
        vm.expectRevert(CTF.Exists.selector);
        ctf.createChallenge(1, flagAddr, 1);
    }
}
