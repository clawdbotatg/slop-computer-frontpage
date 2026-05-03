import { expect } from "chai";
import { ethers } from "hardhat";
import { SlopComputerFrontpage } from "../typechain-types";

describe("SlopComputerFrontpage", function () {
  let frontpage: SlopComputerFrontpage;
  let ownerAddr: string;

  before(async () => {
    const [owner] = await ethers.getSigners();
    ownerAddr = owner.address;
    const factory = await ethers.getContractFactory("SlopComputerFrontpage");
    frontpage = (await factory.deploy(ownerAddr)) as SlopComputerFrontpage;
    await frontpage.waitForDeployment();
  });

  it("starts with no episodes and not live", async () => {
    expect(await frontpage.episodeCount()).to.equal(0n);
    expect(await frontpage.isLive()).to.equal(false);
    expect(await frontpage.liveTitle()).to.equal("");
    expect(await frontpage.liveHlsUrl()).to.equal("");
    expect(await frontpage.owner()).to.equal(ownerAddr);
  });

  it("owner can add an episode", async () => {
    await expect(frontpage.addEpisode("E1", "2026-04-22", "30:00", "desc", "cid1"))
      .to.emit(frontpage, "EpisodeAdded")
      .withArgs(0n, "E1", "cid1");
    expect(await frontpage.episodeCount()).to.equal(1n);
    const ep = await frontpage.getEpisode(0);
    expect(ep.title).to.equal("E1");
    expect(ep.cid).to.equal("cid1");
  });

  it("owner can update an episode", async () => {
    await expect(frontpage.updateEpisode(0, "E1 fixed", "2026-04-22", "30:00", "desc", "cid1"))
      .to.emit(frontpage, "EpisodeUpdated")
      .withArgs(0n, "E1 fixed", "cid1");
    const ep = await frontpage.getEpisode(0);
    expect(ep.title).to.equal("E1 fixed");
  });

  it("getEpisodes returns the full array", async () => {
    await frontpage.addEpisode("E2", "2026-04-29", "44:00", "desc 2", "cid2");
    const all = await frontpage.getEpisodes();
    expect(all.length).to.equal(2);
    expect(all[1].title).to.equal("E2");
  });

  it("owner can goLive with title + hlsUrl", async () => {
    const hls = "https://media.slop.computer/hls/live/index.m3u8";
    await expect(frontpage.goLive("Live: building slop", hls))
      .to.emit(frontpage, "LiveStatusChanged")
      .withArgs(true, "Live: building slop", hls);
    expect(await frontpage.isLive()).to.equal(true);
    expect(await frontpage.liveTitle()).to.equal("Live: building slop");
    expect(await frontpage.liveHlsUrl()).to.equal(hls);
  });

  it("owner can goOffline (clears title + url)", async () => {
    await expect(frontpage.goOffline()).to.emit(frontpage, "LiveStatusChanged").withArgs(false, "", "");
    expect(await frontpage.isLive()).to.equal(false);
    expect(await frontpage.liveTitle()).to.equal("");
    expect(await frontpage.liveHlsUrl()).to.equal("");
  });

  it("non-owner cannot add", async () => {
    const [, other] = await ethers.getSigners();
    await expect(frontpage.connect(other).addEpisode("x", "x", "x", "x", "x")).to.be.revertedWith("not owner");
  });

  it("non-owner cannot goLive", async () => {
    const [, other] = await ethers.getSigners();
    await expect(frontpage.connect(other).goLive("nope", "nope")).to.be.revertedWith("not owner");
  });

  it("non-owner cannot goOffline", async () => {
    const [, other] = await ethers.getSigners();
    await expect(frontpage.connect(other).goOffline()).to.be.revertedWith("not owner");
  });

  it("transferOwnership works and rejects zero", async () => {
    const [, next] = await ethers.getSigners();
    await expect(frontpage.transferOwnership(ethers.ZeroAddress)).to.be.revertedWith("zero owner");
    await expect(frontpage.transferOwnership(next.address))
      .to.emit(frontpage, "OwnershipTransferred")
      .withArgs(ownerAddr, next.address);
    expect(await frontpage.owner()).to.equal(next.address);
  });
});
