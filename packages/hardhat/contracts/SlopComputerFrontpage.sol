// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SlopComputerFrontpage
 * @notice Onchain registry of slop.computer podcast episodes plus live-stream metadata.
 *         The owner curates the episode list and toggles the live banner; anyone can read.
 */
contract SlopComputerFrontpage {
    struct Episode {
        string title;
        string date;
        string duration;
        string description;
        string cid;
    }

    address public owner;

    bool public isLive;
    string public liveTitle;
    string public liveHlsUrl;

    Episode[] private episodes;

    event EpisodeAdded(uint256 indexed index, string title, string cid);
    event EpisodeUpdated(uint256 indexed index, string title, string cid);
    event LiveStatusChanged(bool isLive, string title, string hlsUrl);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address initialOwner) {
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function addEpisode(
        string calldata title,
        string calldata date,
        string calldata duration,
        string calldata description,
        string calldata cid
    ) external onlyOwner {
        episodes.push(Episode(title, date, duration, description, cid));
        emit EpisodeAdded(episodes.length - 1, title, cid);
    }

    function updateEpisode(
        uint256 index,
        string calldata title,
        string calldata date,
        string calldata duration,
        string calldata description,
        string calldata cid
    ) external onlyOwner {
        require(index < episodes.length, "bad index");
        episodes[index] = Episode(title, date, duration, description, cid);
        emit EpisodeUpdated(index, title, cid);
    }

    function goLive(string calldata title, string calldata hlsUrl) external onlyOwner {
        isLive = true;
        liveTitle = title;
        liveHlsUrl = hlsUrl;
        emit LiveStatusChanged(true, title, hlsUrl);
    }

    function goOffline() external onlyOwner {
        isLive = false;
        liveTitle = "";
        liveHlsUrl = "";
        emit LiveStatusChanged(false, "", "");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function episodeCount() external view returns (uint256) {
        return episodes.length;
    }

    function getEpisode(uint256 index) external view returns (Episode memory) {
        require(index < episodes.length, "bad index");
        return episodes[index];
    }

    function getEpisodes() external view returns (Episode[] memory) {
        return episodes;
    }
}
