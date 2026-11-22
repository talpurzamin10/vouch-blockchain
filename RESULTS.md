# Measured Evaluation Results

All numbers below were produced by actually running the commands in this repository. Re-run them and replace these figures if you change the contract.

## Environment (record this in the report)

| Item | Value |
|---|---|
| Node.js | v20.20.2 |
| npm | 10.8.2 |
| Hardhat | 2.29.2 |
| Solidity compiler | 0.8.24 |
| EVM target | paris |
| Optimizer | enabled, runs = 200 |
| OpenZeppelin Contracts | 5.6.1 |
| Test network | in-process Hardhat network (local, no real funds) |

Commands:

```bash
npm install
npm run compile
npm test
npm run coverage
npx hardhat run scripts/gas-benchmark.js
```

## 1. Compilation

`npm run compile` → `Compiled 9 Solidity files successfully (evm target: paris).`

## 2. Functional and security tests

`npm test` → **16 passing, 0 failing** (pass rate 100% of the executed suite).

| # | Scenario | Result |
|---|---|---|
| 1 | Verifier role granted only to the three configured addresses | Pass |
| 2 | Campaign creation works; zero goal and empty proof hash rejected | Pass |
| 3 | Donations accumulate per donor and in the campaign total | Pass |
| 4 | One approval leaves funds in escrow | Pass |
| 5 | Two approvals release the full escrow to the beneficiary | Pass |
| 6 | A verifier cannot vote twice | Pass |
| 7 | A non-verifier cannot vote | Pass |
| 8 | Two rejections finalise as rejected and the donor can refund | Pass |
| 9 | After the deadline, donations are rejected and refunds become available | Pass |
| 10 | A donor cannot claim the same refund twice | Pass |
| 11 | A second approval with no funds raised reverts | Pass |
| 12 | A payout rejected by the beneficiary reverts and leaves escrow/state unchanged | Pass |
| 13 | Refunds blocked for an active campaign before the deadline | Pass |
| 14 | Refunds blocked after funds were released | Pass |
| 15 | Zero-value donation rejected; votes after the deadline rejected | Pass |
| 16 | Duplicate verifier addresses rejected at deployment | Pass |

## 3. Coverage (`npm run coverage`, solidity-coverage 0.8.17)

| File | % Stmts | % Branch | % Funcs | % Lines |
|---|---|---|---|---|
| contracts/VouchVault.sol | 100 | 80.36 | 100 | 100 |
| contracts/mocks/RejectingReceiver.sol | 100 | 100 | 100 | 100 |
| All files | 100 | 80.36 | 100 | 100 |

Remaining uncovered branches are in access-control/library paths (e.g. role-management branches inherited from OpenZeppelin), not unexercised campaign logic.

## 4. Gas benchmark (`npx hardhat run scripts/gas-benchmark.js`)

| Action | Gas used |
|---|---|
| createCampaign | 186,653 |
| donate (first donation, new donor record) | 74,393 |
| donate (repeat donation, same donor) | 40,193 |
| donate (second, distinct donor) | 57,293 |
| vote (first approval, below threshold) | 77,984 |
| vote (second approval, releases funds) | 76,839 |
| vote (second rejection) | 62,318 |
| claimRefund (rejected campaign) | 37,820 |
| claimRefund (expired campaign, sets Expired) | 61,378 |

Interpretation: a donation that creates a new donor record costs more than a repeat donation from the same donor, which is consistent with a cold storage slot versus a warm one. Release and refund are bounded by the per-donor pull design, so refund cost does not grow with the number of donors in a single transaction.

## 5. What these results do not establish

- These tests show the specified behaviours hold on a local EVM; they are **not** a security audit and do not prove the absence of vulnerabilities.
- Gas figures are for an in-process local chain with a specific compiler/optimizer setting and will differ on a live network and with different calldata.
- The oracle problem is untouched by any of these tests: no test can verify that a medical bill is genuine.
