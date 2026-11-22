const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("VouchVault", function () {
  let vault, owner, v1, v2, v3, donor, donor2, beneficiary, stranger;
  const proof = ethers.keccak256(ethers.toUtf8Bytes("sample evidence fingerprint"));
  const duration = 3600;
  const e = ethers.parseEther;
  const status = { Active: 0n, Released: 1n, Rejected: 2n, Expired: 3n };

  async function create(goal = e("5"), seconds = duration) {
    await vault.createCampaign(beneficiary.address, "Emergency care", proof, goal, seconds);
    return 1n;
  }
  async function expire(seconds = duration + 1) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  }

  beforeEach(async function () {
    [owner, v1, v2, v3, donor, donor2, beneficiary, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VouchVault");
    vault = await Factory.deploy([v1.address, v2.address, v3.address]);
    await vault.waitForDeployment();
  });

  it("1. grants verifier role only to the three configured addresses", async function () {
    const role = await vault.VERIFIER_ROLE();
    expect(await vault.hasRole(role, v1.address)).to.equal(true);
    expect(await vault.hasRole(role, v2.address)).to.equal(true);
    expect(await vault.hasRole(role, v3.address)).to.equal(true);
    expect(await vault.hasRole(role, stranger.address)).to.equal(false);
  });

  it("2. creates a campaign and rejects invalid goal or proof hash", async function () {
    await create();
    expect((await vault.campaigns(1)).status).to.equal(status.Active);
    await expect(vault.createCampaign(beneficiary.address, "bad", proof, 0, duration)).to.be.revertedWith("Goal must be > 0");
    await expect(vault.createCampaign(beneficiary.address, "bad", ethers.ZeroHash, 1, duration)).to.be.revertedWith("Proof hash required");
  });

  it("3. tracks cumulative donations from multiple donors", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(donor).donate(1, { value: e("0.5") });
    await vault.connect(donor2).donate(1, { value: e("2") });
    expect(await vault.donations(1, donor.address)).to.equal(e("1.5"));
    expect((await vault.campaigns(1)).totalRaised).to.equal(e("3.5"));
  });

  it("4. holds funds after just one verifier approval", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, true);
    expect((await vault.campaigns(1)).approvalCount).to.equal(1);
    expect((await vault.campaigns(1)).status).to.equal(status.Active);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(e("1"));
  });

  it("5. releases all escrow after two distinct approvals", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, true);
    await expect(vault.connect(v2).voteOnCampaign(1, true)).to.emit(vault, "FundsReleased").withArgs(1, beneficiary.address, e("1"));
    expect((await vault.campaigns(1)).status).to.equal(status.Released);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(0);
  });

  it("6. prevents a verifier from voting twice", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, true);
    await expect(vault.connect(v1).voteOnCampaign(1, true)).to.be.revertedWith("Verifier already voted");
  });

  it("7. blocks unauthorized voting", async function () {
    await create();
    await expect(vault.connect(stranger).voteOnCampaign(1, true)).to.be.reverted;
  });

  it("8. marks rejected after two rejections and lets donor refund", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, false);
    await vault.connect(v2).voteOnCampaign(1, false);
    expect((await vault.campaigns(1)).status).to.equal(status.Rejected);
    await expect(vault.connect(donor).claimRefund(1)).to.emit(vault, "RefundClaimed").withArgs(1, donor.address, e("1"));
    expect(await vault.donations(1, donor.address)).to.equal(0);
  });

  it("9. expires and refunds; rejects donations after deadline", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await expire();
    await expect(vault.connect(donor2).donate(1, { value: e("1") })).to.be.revertedWith("Campaign deadline passed");
    await vault.connect(donor).claimRefund(1);
    expect((await vault.campaigns(1)).status).to.equal(status.Expired);
  });

  it("10. prevents double refunds", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, false);
    await vault.connect(v2).voteOnCampaign(1, false);
    await vault.connect(donor).claimRefund(1);
    await expect(vault.connect(donor).claimRefund(1)).to.be.revertedWith("No refundable balance");
  });

  it("11. reverts a second approval when no funds were raised", async function () {
    await create();
    await vault.connect(v1).voteOnCampaign(1, true);
    await expect(vault.connect(v2).voteOnCampaign(1, true)).to.be.revertedWith("No funds to release");
  });

  it("12. reverts safely when the beneficiary rejects the payout", async function () {
    const Mock = await ethers.getContractFactory("RejectingReceiver");
    const mock = await Mock.deploy();
    await vault.createCampaign(await mock.getAddress(), "Bad target", proof, e("5"), duration);
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, true);
    await expect(vault.connect(v2).voteOnCampaign(1, true)).to.be.revertedWith("Transfer to beneficiary failed");
    // Escrow and campaign state must be unchanged after the failed payout.
    expect((await vault.campaigns(1)).status).to.equal(status.Active);
    expect(await ethers.provider.getBalance(await vault.getAddress())).to.equal(e("1"));
  });

  it("13. blocks refunds for an active campaign before its deadline", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await expect(vault.connect(donor).claimRefund(1)).to.be.revertedWith("Campaign not eligible for refund");
  });

  it("14. blocks refunds after funds were released", async function () {
    await create();
    await vault.connect(donor).donate(1, { value: e("1") });
    await vault.connect(v1).voteOnCampaign(1, true);
    await vault.connect(v2).voteOnCampaign(1, true);
    await expect(vault.connect(donor).claimRefund(1)).to.be.revertedWith("Campaign not eligible for refund");
  });

  it("15. rejects zero-value donations and votes after a deadline", async function () {
    await create();
    await expect(vault.connect(donor).donate(1, { value: 0 })).to.be.revertedWith("Donation must be > 0");
    await expire();
    await expect(vault.connect(v1).voteOnCampaign(1, true)).to.be.revertedWith("Campaign deadline passed");
  });

  it("rejects duplicate verifier addresses at deployment", async function () {
    const Factory = await ethers.getContractFactory("VouchVault");
    await expect(Factory.deploy([v1.address, v1.address, v3.address])).to.be.revertedWith("Duplicate verifier");
  });
});
