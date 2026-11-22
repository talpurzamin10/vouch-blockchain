# Vouch — Your Project in Plain English

**A beginner-friendly guide for Mir Zamin Raza Talpur**  
**Course:** Blockchain | **Class:** BSFT-5A | **Institution:** FAST-NUCES

Use this to learn the project, explain it in your viva/video, and finish the submission honestly. You do not need to memorize every line of Solidity. You do need to understand the problem, the contract's rules, what your tests prove, and what blockchain cannot prove.

---

## 1. The whole idea in one minute

Suppose a person needs urgent medical help and their community collects donations. If all the money goes through one organizer's account and informal messages, contributors may find it difficult to check the total or know why funds were released.

**Vouch is a small blockchain-based escrow prototype.** Donors send money into a smart contract, which holds it. Three appointed verifiers review the medical evidence outside the blockchain. Any **two of the three** must approve before the contract releases the pooled funds to the named beneficiary. If two reject, or the deadline passes while the campaign is still active, each donor can request their own contribution back.

The key distinction: **Vouch makes the money-handling rules and transaction history visible; it does not prove that a medical emergency or bill is real.** People still have to verify that.

---

## 2. Important words in everyday language

| Term | Plain meaning |
|---|---|
| Blockchain | A shared transaction record maintained by a network of computers. Entries are intended to be difficult to change after confirmation. |
| Smart contract | Program stored on a blockchain. It follows specified rules when someone calls its functions. It is not a lawyer and cannot understand real-world truth. |
| Solidity | The programming language used to write this project's contract. |
| Ethereum / EVM | A blockchain platform and its execution environment. This prototype can be tested on a local Ethereum-compatible network without real money. |
| Wallet/address | A blockchain account identifier. A person uses a wallet to sign transactions and prove control of an address. |
| Escrow | Money held temporarily by a neutral mechanism until specified conditions are met. Here, the contract is the escrow. |
| Verifier | A person/address trusted to inspect the medical evidence off-chain and submit one approval or rejection vote. |
| 2-of-3 | At least two out of three different verifiers must agree. One verifier alone cannot release or reject a campaign. |
| Proof hash | A short cryptographic fingerprint of a file. It can help check whether a file is unchanged, but cannot prove the file is truthful. |
| Event | A public log entry emitted by the contract, such as a donation or vote. It helps someone inspect what happened. |
| Gas | A measure of the computation required by a blockchain transaction. A real network charges a fee for gas. A local test chain usually uses test-only balances. |
| Reentrancy | A class of bug where an external recipient calls back into a contract during payment and tries to repeat an action. The contract uses protections and must test this risk. |
| Pull refund | Instead of the contract trying to refund everyone in one go, each donor individually calls the refund function to withdraw their own balance. |
| Oracle problem | The gap between on-chain data and real-world facts. A blockchain can record a submitted claim, but cannot independently inspect a hospital, patient, or paper bill. |

---

## 3. Who does what?

1. **Project administrator / deployer:** deploys the contract and sets the three verifier addresses at deployment. In the current starter contract, the deployer also has the administrative role.
2. **Campaign creator:** submits the beneficiary, campaign title, fundraising target, proof hash, and campaign duration.
3. **Beneficiary:** the address nominated to receive the funds if approved.
4. **Donor:** sends money and can later request a refund if the campaign becomes rejected or expired.
5. **Three verifiers:** inspect evidence off-chain and vote once each. The on-chain contract only checks their registered addresses and votes; it cannot judge their evidence review.
6. **Smart contract:** records campaign and donor balances, enforces time and role rules, counts votes, releases funds or enables refunds, and emits events.

For a classroom demo, these roles can be represented by different test accounts controlled by the local test environment. Do not use real patient records or real funds.

---

## 4. Full workflow, step by step

### A. Setup
The contract is deployed with three different, non-zero verifier addresses. This is the committee for this prototype. Choosing honest and independent verifiers is an organizational responsibility, not something the code can guarantee.

### B. Create a campaign
A creator supplies:
- Beneficiary address.
- Campaign title.
- Proof hash (fingerprint) of off-chain evidence.
- Fundraising target.
- Duration until the deadline.

The contract checks that the beneficiary, target, proof hash, and duration meet basic requirements. It creates a campaign in `Active` state.

### C. Donate
A donor sends a positive amount before the deadline. The contract updates the campaign total and records how much that particular donor contributed. Money remains in the contract while the campaign is active.

### D. Verifiers vote
The registered verifiers review the evidence outside the blockchain. Each verifier can vote once per campaign.
- The first approval does not release the money.
- The **second approval** marks the campaign as released and the contract attempts to send all raised funds to the beneficiary.
- The **second rejection** marks the campaign rejected.
- An address that is not a registered verifier cannot vote.
- A verifier cannot vote twice on the same campaign.

### E. Refund or expiry
- In a rejected campaign, a donor can call `claimRefund()` to get their own recorded contribution back.
- If the deadline passes while the campaign is still active, a donor's refund call changes it to expired and lets the donor withdraw their own recorded contribution.
- After a successful release, refunds are not available through this contract.
- A donor cannot claim the same refund twice because the recorded amount is zeroed before the transfer.

### Explicit design choice: what about the goal?
The current prototype records the fundraising target but **does not require reaching that target before release**. Release is controlled by the 2-of-3 approval rule. This is a deliberate, explicit rule for the current version—not something to leave ambiguous in a presentation. If the supervisor wants “target must also be reached,” the contract and tests must be changed and rerun.

### Campaign states
- `Active`: donations and verifier votes are accepted until the deadline.
- `ApprovedAndReleased`: two approvals have been counted and funds were sent.
- `Rejected`: two rejections have been counted; donors may claim refunds.
- `Expired`: deadline passed while the campaign remained active; donors may claim refunds.

---

## 5. What this project guarantees—and does not

### The contract is intended to enforce
- Donations sent through the contract are accounted for in its campaign and donor records.
- Only the three configured verifiers can vote.
- Each verifier votes at most once per campaign.
- Two approvals are required for the release path.
- Two rejections enable the rejection/refund path.
- Donor refunds are limited to the caller's recorded contribution and cannot be claimed repeatedly.
- Key actions generate public event logs.

These are intended behaviors. Say they are verified **only after the tests actually pass**.

### The contract does not prove
- The patient exists or has a medical emergency.
- The bill is authentic, current, or correctly priced.
- The beneficiary is the right person.
- Verifiers are honest, independent, or not colluding.
- A transaction was understood by the people involved.
- Patient identity or evidence is private if it is placed on a public chain.

The system therefore still needs trusted verifier selection, off-chain checking, privacy care, and (before any real deployment) legal/compliance review and an independent smart-contract audit.

---

## 6. How to explain the code

The source file is `contracts/VouchVault.sol`.

- `AccessControl` supplies role-based permission checks.
- `ReentrancyGuard` protects the external-call functions against common reentrancy patterns.
- `CampaignStatus` lists the four campaign states.
- `Campaign` stores each campaign's details, totals, deadline, vote counts, and state.
- `campaigns` stores campaign records; `donations` tracks each donor's amount per campaign; `hasVoted` prevents repeat voting.
- `createCampaign()` creates a campaign after validating inputs.
- `donate()` accepts and records a contribution before the deadline.
- `voteOnCampaign()` accepts one vote from a verifier and triggers release or rejection at the 2-vote threshold.
- `claimRefund()` makes an eligible campaign expired if needed, clears the caller's balance, then transfers the refund.
- Events such as `DonationReceived`, `VerifierVoted`, and `FundsReleased` create an audit trail.

A simple technical explanation of the refund safety pattern is **checks-effects-interactions**: first check eligibility, then update the contract's internal balance, then make the external payment. If the payment fails, the transaction reverts and the state changes also revert.

---

## 7. How to present it to your supervisor

### 30-second version
“Vouch is a Solidity escrow prototype for emergency medical fundraising. Donations are recorded and held by a smart contract. Three appointed verifiers review medical evidence off-chain; two approvals are required to release funds. If two reject, or the active campaign expires, donors can claim their contributions back. The blockchain makes the transaction and rule execution auditable, but it cannot prove that the medical evidence is genuine.”

### Likely viva questions and simple answers

**Q: Why use blockchain here?**  
A: To make donation transactions and rule execution easier for participants to inspect, and to enforce the agreed escrow rule consistently. Blockchain is not automatically better for every use case; gas costs and public-data privacy are trade-offs.

**Q: Who confirms the bill is real?**  
A: Three trusted people inspect it outside the chain. The contract records their votes and requires two approvals. The contract cannot independently verify the bill.

**Q: What if one verifier is dishonest?**  
A: One verifier cannot meet the 2-of-3 threshold alone. But two dishonest or compromised verifiers could approve a false case. That risk is reduced through real-world verifier selection and oversight, not eliminated by Solidity.

**Q: What if the campaign is rejected?**  
A: Two rejections mark it rejected. Each donor then calls the refund function to withdraw their own amount.

**Q: What if nobody decides before the deadline?**  
A: A donor can call the refund function after expiry. The campaign transitions to expired and eligible donors can withdraw.

**Q: Is the medical bill stored on the blockchain?**  
A: No. The design stores only a hash (fingerprint). Actual evidence should stay off-chain because medical data is sensitive. A hash proves a match to a file, not that the file is true.

**Q: What does your evaluation measure?**  
A: Functional scenario pass rate, Solidity statement/branch coverage, gas used by important actions, and adversarial cases such as unauthorized voting, duplicate votes/refunds, payment failure, and reentrancy. I will report actual tool output, not targets as results.

**Q: Does this prove there are no vulnerabilities?**  
A: No. Tests cover specified cases and coverage shows which code ran; neither proves the absence of all bugs. A real system needs independent security review/audit.

**Q: Why is there no front end?**  
A: The project scope prioritizes contract logic, automated tests, and measurable security/performance results. A user interface is optional and would not replace evidence checks or contract tests.

**Q: Does the target amount have to be reached?**  
A: Not in this prototype. It is recorded for campaign information; the 2-of-3 verifier approvals control release. If the requirement changes, the contract and tests must change too.

---

## 8. What must go in the GitHub repository

Create a **public** GitHub repository named something clear, e.g. `vouch-blockchain`. Upload the actual project folder, not only screenshots or a PDF.

### Required/strongly recommended files
- `contracts/VouchVault.sol` — contract source.
- `test/VouchVault.test.ts` (or `.js`) — automated test suite with at least 8 meaningful scenarios; aim for 10+.
- `package.json` and the package lockfile — reproducible dependency versions.
- Hardhat configuration file (`hardhat.config.ts` or `.js`).
- `README.md` — description, setup, test/build/coverage commands, limitations, and repository contents.
- `REPORT.pdf` — final approved report, once complete (keep `REPORT-DRAFT.md` clearly labelled draft until then).
- `docs/PROJECT-GUIDE.md` or the guide file — optional student reference; do not include private notes if you do not want them public.
- Gas/coverage output, e.g. a concise `results/` table or `EVALUATION.md`, created from real runs.
- `.gitignore` — exclude `node_modules/`, secrets, build artifacts, and local environment files.
- `LICENSE` if your course/repository policy requires one.

### Do not upload
- Wallet seed phrases, private keys, `.env` secrets, API keys, or credentials.
- Real patient names, ID numbers, invoices, medical records, or private verifier details.
- `node_modules/`, private account files, or screenshots presented as a substitute for source/tests.
- Made-up test, gas, coverage, deployment, or security claims.

### Final GitHub check
1. Open the repo link in a private/incognito browser or while signed out; verify it is accessible.
2. Check that the source, tests, README, report, and results are visible.
3. Copy the actual repo URL into the report and video/submission materials. Do not invent or guess the URL.
4. Ensure README instructions work from a clean checkout.

---

## 9. Complete submission checklist (finish in this order)

### A. Build and test the software
- [ ] Add Hardhat/package configuration and lockfile.
- [ ] Add automated tests for roles, campaign validation, donations, approval threshold, rejection threshold, duplicate voting, unauthorized voting, expiry, refunds, duplicate refunds, failed payout, and reentrancy behavior.
- [ ] Run compile/build and all tests; save the actual output.
- [ ] Run coverage and gas benchmarks with recorded tool/compiler settings.
- [ ] Fix failures and rerun everything from a clean install.
- [ ] Check that a campaign's payout behavior matches the documented rule.

### B. Finish the literature review and report
- [ ] Closely read at least 20 relevant scholarly papers; verify every citation and fill the literature matrix.
- [ ] Explain each paper's method, findings, limitations, and relevance; synthesize them rather than listing titles only.
- [ ] Add the flow diagram and written workflow.
- [ ] Replace every “pending” result with measured values and evidence.
- [ ] Include the limitation that on-chain rules do not establish real-world medical truth.
- [ ] Add supervisor name/date and any required title-page details.
- [ ] Proofread and export the final report as a PDF.
- [ ] Give the required hard copy to the supervisor in person; all group members must attend (your proposal currently lists one student, so follow the supervisor's instruction if the team changes).
- [ ] Wait for review/approval before final electronic submission, as instructed.

### C. GitHub and short video
- [ ] Make the repository public/accessibly shared and copy its real URL.
- [ ] Record a short clear video: title/objectives, problem, method/workflow, key contract rules, demo/tests/results, and limitation.
- [ ] Show real test output or a local demo only after it works. Do not imply production deployment if it is only local.
- [ ] Say the oracle limitation plainly: verifiers check evidence off-chain; blockchain records their votes, not the truth.
- [ ] Submit the video file/link by the method your supervisor specifies.

### D. What is currently in this workspace
- `contracts/VouchVault.sol` — starter contract source.
- `README.md` — repository overview and evaluation plan.
- `REPORT-DRAFT.md` — report draft, not final.
- `PROJECT-GUIDE.md` — this plain-English guide.

**Honest status:** the workspace is not yet a complete, tested submission repository. It still needs Hardhat setup, automated tests, real benchmark/coverage output, and completion of the 20-paper review. Do not tell your supervisor or put in GitHub that those things are done until you have actually completed them.
