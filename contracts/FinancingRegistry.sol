// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title FinancingRegistry
/// @notice Append-only financing episodes and their legal terminal transitions.
contract FinancingRegistry {
    enum Status {
        ACTIVE,
        REPAID,
        DEFAULTED,
        CANCELLED
    }

    struct Episode {
        bytes32 commitment;
        address financier;
        Status status;
        uint64 startedAt;
        uint64 endedAt;
    }

    address public immutable OWNER;
    address public gateway;
    uint256 public episodeCount;

    mapping(uint256 episodeId => Episode episode) private _episodes;
    mapping(bytes32 commitment => uint256[] episodeIds) private _episodesByCommitment;
    mapping(bytes32 commitment => uint256 episodeId) public activeEpisode;

    event GatewaySet(address indexed gateway);
    event FinancingEpisodeOpened(
        uint256 indexed episodeId, bytes32 indexed commitment, address indexed financier, uint64 startedAt
    );
    event FinancingEpisodeClosed(uint256 indexed episodeId, Status status, uint64 endedAt);

    modifier onlyGateway() {
        require(msg.sender == gateway, "Only gateway.");
        _;
    }

    constructor() {
        OWNER = msg.sender;
    }

    /// @notice Permanently authorizes the gateway as the sole state writer.
    function setGateway(address _gateway) external {
        require(msg.sender == OWNER, "Only owner.");
        require(gateway == address(0), "Gateway already set.");
        require(_gateway != address(0), "Gateway cannot be zero.");
        gateway = _gateway;
        emit GatewaySet(_gateway);
    }

    function openEpisode(bytes32 _commitment, address _financier, uint64 _timestamp)
        external
        onlyGateway
        returns (uint256 episodeId)
    {
        require(_commitment != bytes32(0), "Commitment cannot be zero.");
        require(_financier != address(0), "Financier cannot be zero.");
        require(activeEpisode[_commitment] == 0, "Active episode exists.");

        episodeId = ++episodeCount;
        _episodes[episodeId] = Episode({
            commitment: _commitment, financier: _financier, status: Status.ACTIVE, startedAt: _timestamp, endedAt: 0
        });
        _episodesByCommitment[_commitment].push(episodeId);
        activeEpisode[_commitment] = episodeId;
        emit FinancingEpisodeOpened(episodeId, _commitment, _financier, _timestamp);
    }

    function closeEpisode(bytes32 _commitment, Status _terminalStatus, uint64 _timestamp) external onlyGateway {
        require(_terminalStatus != Status.ACTIVE, "Status must be terminal.");

        uint256 episodeId = activeEpisode[_commitment];
        require(episodeId != 0, "No active episode.");
        Episode storage episode = _episodes[episodeId];
        require(episode.status == Status.ACTIVE, "Episode is not active.");

        episode.status = _terminalStatus;
        episode.endedAt = _timestamp;
        delete activeEpisode[_commitment];
        emit FinancingEpisodeClosed(episodeId, _terminalStatus, _timestamp);
    }

    function getEpisode(uint256 _episodeId) external view returns (Episode memory) {
        require(_episodeId != 0 && _episodeId <= episodeCount, "Unknown episode.");
        return _episodes[_episodeId];
    }

    function getEpisodeIds(bytes32 _commitment) external view returns (uint256[] memory) {
        return _episodesByCommitment[_commitment];
    }
}
