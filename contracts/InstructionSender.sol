// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// TODO: Replace local interfaces with imports from flare-smart-contracts-v2 once published as a package.
import {ITeeExtensionRegistry} from "./interfaces/ITeeExtensionRegistry.sol";
import {ITeeMachineRegistry} from "./interfaces/ITeeMachineRegistry.sol";

/// @title CleatInstructionSender
/// @author Flare Foundation
/// @notice On-chain entry point for Cleat confidential-compute instructions.
///
/// DO NOT MODIFY: constructor, setExtensionId(), _getExtensionId()
contract CleatInstructionSender {
    /// @notice Cleat operation type.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_CLEAT = bytes32("CLEAT");

    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_CHECK = bytes32("CHECK");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_PLEDGE = bytes32("PLEDGE");
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_RELEASE = bytes32("RELEASE");

    uint64 public constant REQUEST_TTL = 10 minutes;

    /// @notice Reference to the TEE extension registry contract.
    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    /// @notice Reference to the TEE machine registry contract.
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    /// @notice First public extension ID. The registry reserves IDs below this
    /// for system/reserved extensions; public extensions are assigned from here up.
    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000; // 65536

    uint256 private _extensionId;

    /// @notice Public fields delivered with an FCC instruction.
    /// @dev The FCC registry creates requestId/instructionId; it is recorded after
    /// sendInstructions returns and therefore cannot be embedded in originalMessage.
    struct CleatMessage {
        bytes32 commitment;
        address financier;
        uint64 validUntil;
    }

    struct Request {
        bytes32 command;
        bytes32 commitment;
        address financier;
        uint64 validUntil;
        bool exists;
    }

    mapping(bytes32 requestId => Request request) private _requests;

    event CleatInstructionSent(
        bytes32 indexed requestId,
        bytes32 indexed command,
        bytes32 indexed commitment,
        address financier,
        uint64 validUntil
    );

    /// @notice Initializes the contract with registry addresses.
    /// @param _teeExtensionRegistry Address of the TEE extension registry.
    /// @param _teeMachineRegistry Address of the TEE machine registry.
    constructor(ITeeExtensionRegistry _teeExtensionRegistry, ITeeMachineRegistry _teeMachineRegistry) {
        require(address(_teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero address");
        require(address(_teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero address");
        require(address(_teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(_teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");
        TEE_EXTENSION_REGISTRY = _teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = _teeMachineRegistry;
    }

    /// @notice Finds and sets this contract's extension id. Can only be set once.
    /// DO NOT MODIFY this function.
    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");

        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    /// @notice Sends a read-only uniqueness check.
    function sendCheck(bytes32 _commitment) external payable returns (bytes32 requestId) {
        requestId = _sendInstruction(OP_COMMAND_CHECK, _commitment, address(0));
    }

    /// @notice Sends a check-then-set pledge instruction.
    /// @dev The financier is always msg.sender and is never accepted as input.
    function sendPledge(bytes32 _commitment) external payable returns (bytes32 requestId) {
        requestId = _sendInstruction(OP_COMMAND_PLEDGE, _commitment, msg.sender);
    }

    /// @notice Sends a release/default-evaluation instruction.
    /// @dev Authorization is enforced again when the attested result is consumed.
    function sendRelease(bytes32 _commitment) external payable returns (bytes32 requestId) {
        requestId = _sendInstruction(OP_COMMAND_RELEASE, _commitment, msg.sender);
    }

    /// @notice Returns the immutable binding recorded for an FCC instruction.
    function getRequest(bytes32 _requestId) external view returns (Request memory) {
        return _requests[_requestId];
    }

    function _sendInstruction(bytes32 _command, bytes32 _commitment, address _financier)
        private
        returns (bytes32 requestId)
    {
        require(_commitment != bytes32(0), "Commitment cannot be zero.");

        uint64 validUntil = uint64(block.timestamp + REQUEST_TTL);
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_CLEAT,
            opCommand: _command,
            message: abi.encode(CleatMessage({commitment: _commitment, financier: _financier, validUntil: validUntil})),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        requestId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        require(requestId != bytes32(0), "Invalid request ID.");
        require(!_requests[requestId].exists, "Duplicate request ID.");

        _requests[requestId] = Request({
            command: _command, commitment: _commitment, financier: _financier, validUntil: validUntil, exists: true
        });
        emit CleatInstructionSent(requestId, _command, _commitment, _financier, validUntil);
    }

    /// @notice Returns the cached extension ID, reverting if not yet set.
    /// @return The extension ID assigned to this contract.
    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }
}
