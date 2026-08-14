// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {CleatInstructionSender} from "../contracts/InstructionSender.sol";
import {FinancingRegistry} from "../contracts/FinancingRegistry.sol";
import {PledgeRegistry} from "../contracts/PledgeRegistry.sol";
import {ICleatInstructionSender, VerificationGateway} from "../contracts/VerificationGateway.sol";
import {ITeeExtensionRegistry} from "../contracts/interfaces/ITeeExtensionRegistry.sol";
import {ITeeMachineRegistry} from "../contracts/interfaces/ITeeMachineRegistry.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 newTimestamp) external;
}

contract MockTeeExtensionRegistry is ITeeExtensionRegistry {
    uint256 public constant EXTENSION_ID = 0x10000;
    uint256 private _nonce;
    address private _instructionSender;

    function registerSender(address sender) external {
        _instructionSender = sender;
    }

    function sendInstructions(address[] calldata, TeeInstructionParams calldata)
        external
        payable
        returns (bytes32 instructionId)
    {
        instructionId = keccak256(abi.encode(address(this), msg.sender, ++_nonce));
    }

    function nextPublicExtensionId() external pure returns (uint256) {
        return EXTENSION_ID + 1;
    }

    function getTeeExtensionInstructionsSender(uint256 extensionId) external view returns (address) {
        return extensionId == EXTENSION_ID ? _instructionSender : address(0);
    }
}

contract MockTeeMachineRegistry is ITeeMachineRegistry {
    address private constant _TEE_ID = address(0xBEEF);

    function getRandomTeeIds(uint256, uint256 count) external pure returns (address[] memory teeIds) {
        teeIds = new address[](count);
        for (uint256 i; i < count; ++i) {
            teeIds[i] = _TEE_ID;
        }
    }
}

contract CleatProtocolTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant _TEE_PRIVATE_KEY = 0xA11CE;
    address private constant _FINANCIER_A = address(0xA11);
    address private constant _FINANCIER_B = address(0xB22);

    bytes32 private constant _COMMITMENT = 0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes32 private constant _ALTERED_AMOUNT_COMMITMENT =
        0x2222222222222222222222222222222222222222222222222222222222222222;
    bytes32 private constant _ALTERED_DEBTOR_COMMITMENT =
        0x3333333333333333333333333333333333333333333333333333333333333333;

    CleatInstructionSender private _sender;
    PledgeRegistry private _pledges;
    FinancingRegistry private _financings;
    VerificationGateway private _gateway;

    function setUp() public {
        MockTeeExtensionRegistry extensionRegistry = new MockTeeExtensionRegistry();
        MockTeeMachineRegistry machineRegistry = new MockTeeMachineRegistry();
        _sender = new CleatInstructionSender(extensionRegistry, machineRegistry);
        extensionRegistry.registerSender(address(_sender));
        _sender.setExtensionId();

        _pledges = new PledgeRegistry();
        _financings = new FinancingRegistry();
        _gateway = new VerificationGateway(ICleatInstructionSender(address(_sender)), _pledges, _financings);
        _pledges.setGateway(address(_gateway));
        _financings.setGateway(address(_gateway));
        _gateway.setTeeSigner(vm.addr(_TEE_PRIVATE_KEY), true);
    }

    function testDuplicatePledgeIsBlocked() public {
        _consumePledge(_COMMITMENT, _FINANCIER_A);

        bytes32 duplicateRequest = _sendPledge(_COMMITMENT, _FINANCIER_B);

        vm.expectRevert(_error("Active episode exists."));
        this.gatewayConsume(duplicateRequest, _COMMITMENT, VerificationGateway.Verdict.CLEAR);

        PledgeRegistry.Pledge memory pledge = _pledges.getPledge(_COMMITMENT);
        require(pledge.status == PledgeRegistry.Status.ACTIVE, "pledge not active");
        require(pledge.financier == _FINANCIER_A, "financier changed");
        require(_financings.episodeCount() == 1, "duplicate episode");
    }

    function testAlteredAmountCommitmentBindingIsRejected() public {
        bytes32 requestId = _sendCheck(_COMMITMENT);

        vm.expectRevert(_error("Commitment mismatch."));
        this.gatewayConsume(requestId, _ALTERED_AMOUNT_COMMITMENT, VerificationGateway.Verdict.CLEAR);
    }

    function testAlteredDebtorCommitmentBindingIsRejected() public {
        bytes32 requestId = _sendCheck(_COMMITMENT);

        vm.expectRevert(_error("Commitment mismatch."));
        this.gatewayConsume(requestId, _ALTERED_DEBTOR_COMMITMENT, VerificationGateway.Verdict.CLEAR);
    }

    function testExpiredCheckIsRejected() public {
        bytes32 requestId = _sendCheck(_COMMITMENT);
        uint64 validUntil = _validUntil(requestId);
        vm.warp(uint256(validUntil) + 1);

        vm.expectRevert(_error("Request expired."));
        this.gatewayConsume(requestId, _COMMITMENT, VerificationGateway.Verdict.CLEAR);
    }

    function testUnauthorizedReleaseIsRejected() public {
        _consumePledge(_COMMITMENT, _FINANCIER_A);

        bytes32 requestId = _sendRelease(_COMMITMENT, _FINANCIER_B);

        vm.expectRevert(_error("Only active financier."));
        this.gatewayConsume(requestId, _COMMITMENT, VerificationGateway.Verdict.RELEASED);
    }

    function testRequestIdCanOnlyBeConsumedOnce() public {
        bytes32 requestId = _sendCheck(_COMMITMENT);
        gatewayConsume(requestId, _COMMITMENT, VerificationGateway.Verdict.CLEAR);

        vm.expectRevert(_error("Request already consumed."));
        this.gatewayConsume(requestId, _COMMITMENT, VerificationGateway.Verdict.CLEAR);
    }

    function testReleasedCommitmentStartsNewActiveEpisode() public {
        _consumePledge(_COMMITMENT, _FINANCIER_A);
        _consumeRelease(_COMMITMENT, _FINANCIER_A, VerificationGateway.Verdict.RELEASED);
        _consumePledge(_COMMITMENT, _FINANCIER_B);

        uint256[] memory ids = _financings.getEpisodeIds(_COMMITMENT);
        require(ids.length == 2, "expected two episodes");
        FinancingRegistry.Episode memory first = _financings.getEpisode(ids[0]);
        FinancingRegistry.Episode memory second = _financings.getEpisode(ids[1]);
        require(first.status == FinancingRegistry.Status.REPAID, "first not repaid");
        require(second.status == FinancingRegistry.Status.ACTIVE, "second not active");
        require(second.financier == _FINANCIER_B, "wrong second financier");
    }

    function testDefaultedCommitmentCannotReactivate() public {
        _consumePledge(_COMMITMENT, _FINANCIER_A);
        _consumeRelease(_COMMITMENT, _FINANCIER_A, VerificationGateway.Verdict.DEFAULTED);

        bytes32 requestId = _sendPledge(_COMMITMENT, _FINANCIER_B);
        vm.expectRevert(_error("Pledge cannot activate."));
        this.gatewayConsume(requestId, _COMMITMENT, VerificationGateway.Verdict.CLEAR);

        PledgeRegistry.Pledge memory pledge = _pledges.getPledge(_COMMITMENT);
        require(pledge.status == PledgeRegistry.Status.DEFAULT, "default changed");
        require(_financings.episodeCount() == 1, "reactivation episode persisted");
    }

    function testOnlyGatewayCanWritePledgeRegistry() public {
        vm.expectRevert(_error("Only gateway."));
        _pledges.activate(_COMMITMENT, _FINANCIER_A, uint64(block.timestamp));
    }

    function testPledgeFinancierIsDerivedFromSender() public {
        bytes32 requestId = _sendPledge(_COMMITMENT, _FINANCIER_A);
        CleatInstructionSender.Request memory request = _sender.getRequest(requestId);
        require(request.exists, "request missing");
        require(request.financier == _FINANCIER_A, "financier not msg.sender");
    }

    function _consumePledge(bytes32 commitment, address financier) private {
        bytes32 requestId = _sendPledge(commitment, financier);
        gatewayConsume(requestId, commitment, VerificationGateway.Verdict.CLEAR);
    }

    function _consumeRelease(bytes32 commitment, address financier, VerificationGateway.Verdict verdict) private {
        bytes32 requestId = _sendRelease(commitment, financier);
        gatewayConsume(requestId, commitment, verdict);
    }

    function _sendCheck(bytes32 commitment) private returns (bytes32 requestId) {
        requestId = _sender.sendCheck(commitment);
    }

    function _sendPledge(bytes32 commitment, address financier) private returns (bytes32 requestId) {
        vm.prank(financier);
        requestId = _sender.sendPledge(commitment);
    }

    function _sendRelease(bytes32 commitment, address financier) private returns (bytes32 requestId) {
        vm.prank(financier);
        requestId = _sender.sendRelease(commitment);
    }

    function gatewayConsume(bytes32 requestId, bytes32 commitment, VerificationGateway.Verdict verdict) public {
        bytes memory resultData = abi.encode(requestId, commitment, verdict);
        bytes32 resultHash = _gateway.actionResultHash(resultData, requestId, "end", 1);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", resultHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_TEE_PRIVATE_KEY, digest);
        _gateway.consumeResult(resultData, "end", 1, abi.encodePacked(r, s, v));
    }

    function _validUntil(bytes32 requestId) private view returns (uint64 validUntil) {
        return _sender.getRequest(requestId).validUntil;
    }

    function _error(string memory reason) private pure returns (bytes memory) {
        return abi.encodeWithSignature("Error(string)", reason);
    }
}
