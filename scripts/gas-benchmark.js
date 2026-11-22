// Gas benchmark for the main VouchVault actions.
// Run: npx hardhat run scripts/gas-benchmark.js
// Reports gas used per action on the in-process Hardhat EVM. Numbers are
// machine/compiler dependent: record the toolchain versions with the results.
const { ethers, network } = require("hardhat");

async function main() {
  const e = ethers.parseEther;
  const proof = ethers.keccak256(ethers.toUtf8Bytes("benchmark evidence fingerprint"));
  const [owner, v1, v2, v3, donor, donor2, beneficiary] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("VouchVault");
  const vault = await Factory.deploy([v1.address, v2.address, v3.address]);
  await vault.waitForDeployment();

  const rows = [];
  const record = async (label, txPromise) => {
    const tx = await txPromise;
    const receipt = await tx.wait();
    rows.push([label, receipt.gasUsed.toString()]);
    return receipt;
  };

  await record("createCampaign", vault.createCampaign(beneficiary.address, "Emergency care", proof, e("5"), 7 * 24 * 3600));
  await record("donate (first donation, campaign 1)", vault.connect(donor).donate(1, { value: e("1") }));
  await record("donate (repeat donation, same donor)", vault.connect(donor).donate(1, { value: e("1") }));
  await record("donate (new donor)", vault.connect(donor2).donate(1, { value: e("2") }));
  await record("vote (first approval, below threshold)", vault.connect(v1).voteOnCampaign(1, true));
  await record("vote (second approval, releases funds)", vault.connect(v2).voteOnCampaign(1, true));

  // Rejection + refund path on a second campaign.
  await vault.createCampaign(beneficiary.address, "Second case", proof, e("5"), 7 * 24 * 3600);
  await vault.connect(donor).donate(2, { value: e("1") });
  await vault.connect(v1).voteOnCampaign(2, false);
  await record("vote (second rejection)", vault.connect(v2).voteOnCampaign(2, false));
  await record("claimRefund (rejected campaign)", vault.connect(donor).claimRefund(2));

  // Expiry path on a third campaign.
  await vault.createCampaign(beneficiary.address, "Third case", proof, e("5"), 3600);
  await vault.connect(donor).donate(3, { value: e("1") });
  await network.provider.send("evm_increaseTime", [3601]);
  await network.provider.send("evm_mine");
  await record("claimRefund (expired campaign, sets Expired)", vault.connect(donor).claimRefund(3));

  const version = require("hardhat/package.json").version;
  console.log(`\nHardhat ${version} | Solidity 0.8.24 | optimizer on (200 runs) | EVM: in-process Hardhat network`);
  console.log(`Accounts used: ${owner.address.slice(0, 10)}... (deployer), verifiers ${v1.address.slice(0, 8)}..., ${v2.address.slice(0, 8)}..., ${v3.address.slice(0, 8)}...\n`);
  console.log("Action".padEnd(52) + "Gas used");
  console.log("-".repeat(64));
  for (const [label, gas] of rows) console.log(label.padEnd(52) + gas);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
