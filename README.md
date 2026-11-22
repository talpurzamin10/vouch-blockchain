# Vouch — Transparent Emergency Medical Fundraising

Vouch is a Solidity escrow prototype for emergency fundraising. It records donations and campaign state on-chain; three pre-appointed verifiers inspect evidence off-chain, then a 2-of-3 approval releases escrow to the named beneficiary. A 2-of-3 rejection or campaign expiry permits donors to pull refunds.

## Scope and limitations
The chain proves that a particular address submitted a vote and that the contract followed its programmed rules. It does **not** prove that a medical bill, identity, treatment, or verifier decision is truthful. Evidence is represented by a `bytes32` hash; sensitive documents must remain off-chain. Verifier KYC, independent review, privacy protections, and legal/compliance review are outside this prototype.

## Status
Hardhat project configuration and a local automated test suite are included. In the current workspace, `npm run compile` succeeded and `npm test` reported **16 passing tests** (0 failing). `npm run coverage` reported **100% statements, 80.36% branches, 100% functions, 100% lines** for the instrumented contract. Gas benchmarks were measured with `npx hardhat run scripts/gas-benchmark.js`; see `RESULTS.md` for the full table and environment. These are local prototype results, not an audit or proof of zero vulnerabilities. The 20-paper close literature review remains incomplete. Re-run all commands after a clean checkout and record the environment before final submission.

## Quick start
Requires Node.js 20+.

```bash
npm install
npm run compile     # hardhat compile
npm test            # hardhat test  -> 16 passing
npm run coverage    # hardhat coverage
npx hardhat run scripts/gas-benchmark.js
```

## Evaluation plan
- Functional: 10+ scenario tests; report actual pass/total.
- Coverage: Solidity statement and branch coverage from a compatible coverage tool; report measured values.
- Gas: measure `donate`, first verifier vote, and threshold approval on a local EVM using the same compiler settings; report median over repeated runs and units (gas).
- Security: test authorization, replay/double voting, refund replay, failed external payment, and reentrancy. Tests are not a formal audit and cannot establish zero vulnerabilities.

## Repository checklist before sharing
Add tests, lockfile, license, complete report, reproducible commands, and a GitHub URL. Never commit wallet seed phrases, private keys, or real patients' personal/medical information.
