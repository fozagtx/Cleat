// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title PledgeRegistry
/// @notice Authoritative public pledge status keyed only by a commitment.
contract PledgeRegistry {
    enum Status {
        UNPLEDGED,
        ACTIVE,
        RELEASED,
        DEFAULT
    }

    struct Pledge {
        address financier;
        Status status;
        uint64 timestamp;
    }

    address public immutable OWNER;
    address public gateway;

    mapping(bytes32 commitment => Pledge pledge) private _pledges;

    event GatewaySet(address indexed gateway);
    event PledgeStatusChanged(bytes32 indexed commitment, address indexed financier, Status status, uint64 timestamp);

    modifier onlyGateway() {
        require(msg.sender == gateway, "Only gateway.");
        _;
    }

    constructor() {
        OWNER = msg.sender;
    }

    /// @notice Permanently authorizes the sole state writer.
    function setGateway(address _gateway) external {
        require(msg.sender == OWNER, "Only owner.");
        require(gateway == address(0), "Gateway already set.");
        require(_gateway != address(0), "Gateway cannot be zero.");
        gateway = _gateway;
        emit GatewaySet(_gateway);
    }

    function getPledge(bytes32 _commitment) external view returns (Pledge memory) {
        return _pledges[_commitment];
    }

    function activate(bytes32 _commitment, address _financier, uint64 _timestamp) external onlyGateway {
        require(_commitment != bytes32(0), "Commitment cannot be zero.");
        require(_financier != address(0), "Financier cannot be zero.");

        Status current = _pledges[_commitment].status;
        require(current == Status.UNPLEDGED || current == Status.RELEASED, "Pledge cannot activate.");

        _pledges[_commitment] = Pledge({financier: _financier, status: Status.ACTIVE, timestamp: _timestamp});
        emit PledgeStatusChanged(_commitment, _financier, Status.ACTIVE, _timestamp);
    }

    function release(bytes32 _commitment, uint64 _timestamp) external onlyGateway {
        Pledge storage pledge = _pledges[_commitment];
        require(pledge.status == Status.ACTIVE, "Pledge is not active.");
        pledge.financier = address(0);
        pledge.status = Status.RELEASED;
        pledge.timestamp = _timestamp;
        emit PledgeStatusChanged(_commitment, address(0), Status.RELEASED, _timestamp);
    }

    function markDefault(bytes32 _commitment, uint64 _timestamp) external onlyGateway {
        Pledge storage pledge = _pledges[_commitment];
        require(pledge.status == Status.ACTIVE, "Pledge is not active.");
        pledge.status = Status.DEFAULT;
        pledge.timestamp = _timestamp;
        emit PledgeStatusChanged(_commitment, pledge.financier, Status.DEFAULT, _timestamp);
    }
}
