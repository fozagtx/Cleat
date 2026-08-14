// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FinancingRegistry} from "./FinancingRegistry.sol";
import {PledgeRegistry} from "./PledgeRegistry.sol";

interface ICleatInstructionSender {
    function getRequest(bytes32 _requestId)
        external
        view
        returns (bytes32 command, bytes32 commitment, address financier, uint64 validUntil, bool exists);
}

/// @title VerificationGateway
/// @notice Verifies and consumes TEE-signed FCC results before updating registries.
contract VerificationGateway {
    enum Verdict {
        INVALID,
        CLEAR,
        ALREADY_PLEDGED,
        RELEASED,
        DEFAULTED,
        CANCELLED
    }

    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_CHECK = bytes32("CHECK");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_PLEDGE = bytes32("PLEDGE");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_RELEASE = bytes32("RELEASE");

    // secp256k1n / 2; rejects malleable high-s ECDSA signatures.
    uint256 private constant _MAX_VALID_S = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public immutable OWNER;
    ICleatInstructionSender public immutable INSTRUCTION_SENDER;
    PledgeRegistry public immutable PLEDGE_REGISTRY;
    FinancingRegistry public immutable FINANCING_REGISTRY;

    mapping(address teeSigner => bool authorized) public authorizedTeeSigners;
    mapping(bytes32 requestId => bool consumed) public consumedRequestIds;

    event TeeSignerAuthorizationChanged(address indexed teeSigner, bool authorized);
    event ResultConsumed(
        bytes32 indexed requestId,
        bytes32 indexed command,
        bytes32 indexed commitment,
        address financier,
        Verdict verdict
    );

    constructor(
        ICleatInstructionSender _instructionSender,
        PledgeRegistry _pledgeRegistry,
        FinancingRegistry _financingRegistry
    ) {
        require(address(_instructionSender) != address(0), "Sender cannot be zero.");
        require(address(_pledgeRegistry) != address(0), "Pledge registry cannot be zero.");
        require(address(_financingRegistry) != address(0), "Financing registry cannot be zero.");
        require(address(_instructionSender).code.length > 0, "Sender has no code.");
        require(address(_pledgeRegistry).code.length > 0, "Pledge registry has no code.");
        require(address(_financingRegistry).code.length > 0, "Financing registry has no code.");

        OWNER = msg.sender;
        INSTRUCTION_SENDER = _instructionSender;
        PLEDGE_REGISTRY = _pledgeRegistry;
        FINANCING_REGISTRY = _financingRegistry;
    }

    /// @notice Authorizes a registered FCC TEE identity to attest results.
    function setTeeSigner(address _teeSigner, bool _authorized) external {
        require(msg.sender == OWNER, "Only owner.");
        require(_teeSigner != address(0), "TEE signer cannot be zero.");
        authorizedTeeSigners[_teeSigner] = _authorized;
        emit TeeSignerAuthorizationChanged(_teeSigner, _authorized);
    }

    /// @notice Reproduces tee-node ActionResult.Hash().
    /// @dev keccak256(keccak256(data) || id || keccak256(submissionTag) || status).
    function actionResultHash(
        bytes calldata _resultData,
        bytes32 _requestId,
        string calldata _submissionTag,
        uint8 _resultStatus
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(keccak256(_resultData), _requestId, keccak256(bytes(_submissionTag)), _resultStatus)
        );
    }

    /// @notice Consumes one FCC ActionResponse result and applies its legal transition.
    /// @dev resultData is ABI-encoded as (requestId, commitment, verdict).
    function consumeResult(
        bytes calldata _resultData,
        string calldata _submissionTag,
        uint8 _resultStatus,
        bytes calldata _signature
    ) external {
        (bytes32 _requestId, bytes32 _commitment, Verdict _verdict) =
            abi.decode(_resultData, (bytes32, bytes32, Verdict));
        require(!consumedRequestIds[_requestId], "Request already consumed.");
        require(_resultStatus == 1, "TEE result failed.");

        (bytes32 command, bytes32 boundCommitment, address financier, uint64 validUntil, bool exists) =
            INSTRUCTION_SENDER.getRequest(_requestId);

        require(exists, "Unknown request.");
        require(boundCommitment == _commitment, "Commitment mismatch.");
        require(block.timestamp <= validUntil, "Request expired.");

        bytes32 resultHash = actionResultHash(_resultData, _requestId, _submissionTag, _resultStatus);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", resultHash));
        require(authorizedTeeSigners[_recover(digest, _signature)], "Unauthorized TEE result.");

        consumedRequestIds[_requestId] = true;
        uint64 timestamp = uint64(block.timestamp);

        if (command == OP_COMMAND_CHECK) {
            _consumeCheck(_verdict);
        } else if (command == OP_COMMAND_PLEDGE) {
            _consumePledge(boundCommitment, financier, timestamp, _verdict);
        } else if (command == OP_COMMAND_RELEASE) {
            _consumeRelease(boundCommitment, financier, timestamp, _verdict);
        } else {
            revert("Unknown command.");
        }

        emit ResultConsumed(_requestId, command, boundCommitment, financier, _verdict);
    }

    function _consumeCheck(Verdict _verdict) private pure {
        require(
            _verdict == Verdict.CLEAR || _verdict == Verdict.ALREADY_PLEDGED || _verdict == Verdict.INVALID,
            "Invalid CHECK verdict."
        );
    }

    function _consumePledge(bytes32 _commitment, address _financier, uint64 _timestamp, Verdict _verdict) private {
        require(_verdict == Verdict.CLEAR, "PLEDGE was not eligible.");
        FINANCING_REGISTRY.openEpisode(_commitment, _financier, _timestamp);
        PLEDGE_REGISTRY.activate(_commitment, _financier, _timestamp);
    }

    function _consumeRelease(bytes32 _commitment, address _financier, uint64 _timestamp, Verdict _verdict) private {
        PledgeRegistry.Pledge memory pledge = PLEDGE_REGISTRY.getPledge(_commitment);
        require(pledge.status == PledgeRegistry.Status.ACTIVE, "Pledge is not active.");
        require(pledge.financier == _financier, "Only active financier.");

        if (_verdict == Verdict.RELEASED) {
            FINANCING_REGISTRY.closeEpisode(_commitment, FinancingRegistry.Status.REPAID, _timestamp);
            PLEDGE_REGISTRY.release(_commitment, _timestamp);
        } else if (_verdict == Verdict.CANCELLED) {
            FINANCING_REGISTRY.closeEpisode(_commitment, FinancingRegistry.Status.CANCELLED, _timestamp);
            PLEDGE_REGISTRY.release(_commitment, _timestamp);
        } else if (_verdict == Verdict.DEFAULTED) {
            FINANCING_REGISTRY.closeEpisode(_commitment, FinancingRegistry.Status.DEFAULTED, _timestamp);
            PLEDGE_REGISTRY.markDefault(_commitment, _timestamp);
        } else {
            revert("Invalid RELEASE verdict.");
        }
    }

    function _recover(bytes32 _digest, bytes calldata _signature) private pure returns (address signer) {
        require(_signature.length == 65, "Invalid signature length.");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(_signature.offset)
            s := calldataload(add(_signature.offset, 32))
            v := byte(0, calldataload(add(_signature.offset, 64)))
        }

        require(uint256(s) <= _MAX_VALID_S, "Invalid signature s.");
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature v.");
        signer = ecrecover(_digest, v, r, s);
        require(signer != address(0), "Invalid signature.");
    }
}
