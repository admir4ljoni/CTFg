// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CTF} from "../src/CTF.sol";
import {Vulnerable} from "../src/Vulnerable.sol";
import {PrivateLocker} from "../src/PrivateLocker.sol";

contract CTFTest is Test {
    CTF ctf;
    uint256 flagKey = uint256(keccak256("MONAD{test}"));
    address flagAddr = vm.addr(flagKey);
    address player = makeAddr("player");

    function meta(string memory t) internal pure returns (CTF.Info memory) {
        return CTF.Info(t, "text", "hint");
    }

    function setUp() public {
        ctf = new CTF();
        ctf.createChallenge(flagAddr, 100, meta("one")); // id 1
    }

    function sign(uint256 key, uint256 id, address who) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encode(id, who)));
        return abi.encodePacked(r, s, v);
    }

    function testSubmit() public {
        vm.prank(player);
        ctf.submit(1, sign(flagKey, 1, player));
        assertEq(ctf.score(player), 100);
        (,, uint32 solves,,) = ctf.challenges(1);
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

    function testIdsAndInfo() public {
        assertEq(ctf.createChallenge(flagAddr, 1, meta("two")), 2);
        assertEq(ctf.count(), 2);
        (string memory t, string memory x, string memory h) = ctf.info(2);
        assertEq(t, "two");
        assertEq(x, "text");
        assertEq(h, "hint");
        vm.expectRevert(bytes("title"));
        ctf.createChallenge(flagAddr, 1, meta(""));
    }

    function testBountyPaysFirstSolverMinusFee() public {
        ctf.createChallenge{value: 1 ether}(flagAddr, 50, meta("two"));
        ctf.topUp{value: 1 ether}(2);
        address second = makeAddr("second");

        vm.prank(player);
        ctf.submit(2, sign(flagKey, 2, player));
        assertEq(player.balance, 1.9 ether); // 2 MON minus 5%
        assertEq(ctf.fees(), 0.1 ether);

        vm.prank(second);
        ctf.submit(2, sign(flagKey, 2, second));
        assertEq(second.balance, 0);
        assertEq(ctf.score(second), 50);
        assertEq(address(ctf).balance, 0.1 ether);
    }

    function testWithdrawFeesOwnerOnly() public {
        ctf.createChallenge{value: 1 ether}(flagAddr, 50, meta("two"));
        vm.prank(player);
        ctf.submit(2, sign(flagKey, 2, player));

        vm.prank(player);
        vm.expectRevert(CTF.NotOwner.selector);
        ctf.withdrawFees();

        uint256 before = address(this).balance;
        ctf.withdrawFees();
        assertEq(address(this).balance - before, 0.05 ether);
        assertEq(ctf.fees(), 0);
    }

    function testPlayersAndFirstBlood() public {
        address second = makeAddr("second");
        ctf.createChallenge(flagAddr, 50, meta("two"));
        vm.prank(player);
        ctf.submit(1, sign(flagKey, 1, player));
        vm.prank(second);
        ctf.submit(1, sign(flagKey, 1, second));
        vm.prank(player);
        ctf.submit(2, sign(flagKey, 2, player));

        address[] memory p = ctf.getPlayers();
        assertEq(p.length, 2); // player listed once despite two solves
        assertEq(p[0], player);
        assertEq(p[1], second);
        assertEq(ctf.firstBlood(1), player);
        assertEq(ctf.firstBlood(2), player);
    }

    function testTopUpUnknownReverts() public {
        vm.expectRevert(CTF.Unknown.selector);
        ctf.topUp{value: 1}(99);
    }

    function testInstanceExploitAndSubmit() public {
        assertEq(
            ctf.createInstanceChallenge{value: 1 ether}(
                200, type(Vulnerable).creationCode, "contract Vulnerable {}", meta("vault")
            ),
            2
        );
        assertEq(ctf.levelSource(2), "contract Vulnerable {}");
        vm.startPrank(player);
        vm.expectRevert(CTF.NotSolved.selector);
        ctf.submitInstance(2); // no instance yet

        Vulnerable v = Vulnerable(ctf.deployInstance(2));
        assertEq(ctf.instances(2, player), address(v));
        assertEq(v.player(), player);
        vm.expectRevert(CTF.NotSolved.selector);
        ctf.submitInstance(2); // not drained

        v.withdraw(100); // the bug: no owner check
        ctf.submitInstance(2);
        assertEq(ctf.score(player), 200);
        assertEq(player.balance, 0.95 ether);
        vm.expectRevert(CTF.AlreadySolved.selector);
        ctf.submitInstance(2);
    }

    function testInstanceOnlyForInstanceChallenges() public {
        vm.expectRevert(CTF.NotInstance.selector);
        ctf.deployInstance(1);
        vm.expectRevert(CTF.NotInstance.selector);
        ctf.submitInstance(1);
    }

    function testCreateChallengeRejectsInstanceSentinel() public {
        address inst = ctf.INSTANCE();
        vm.expectRevert(bytes("flag"));
        ctf.createChallenge(inst, 1, meta("x"));
    }

    function testPrivateLocker() public {
        uint256 id = ctf.createInstanceChallenge(300, type(PrivateLocker).creationCode, "src", meta("locker"));
        vm.startPrank(player);
        PrivateLocker l = PrivateLocker(ctf.deployInstance(id));
        vm.expectRevert(bytes("wrong password"));
        l.unlock(bytes32(0));
        bytes32 pw = vm.load(address(l), bytes32(uint256(0))); // what `cast storage <addr> 0` returns
        l.unlock(pw);
        ctf.submitInstance(id);
        assertEq(ctf.score(player), 300);
    }

    receive() external payable {}
}
