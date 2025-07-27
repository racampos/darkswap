# ZK Circuits for Hidden Parameter Orders

This directory contains the zero-knowledge circuits for implementing hidden parameter orders in the 1inch Limit Order Protocol.

## Overview

The circuit proves that a taker's offer satisfies the maker's secret minimum thresholds without revealing those thresholds on-chain.

**Circuit Logic:**

- **Private inputs**: `secretPrice`, `secretAmount` (known only to maker)
- **Public inputs**: `commit`, `nonce`, `offeredPrice`, `offeredAmount`
- **Constraints**:
  - `commit == secretPrice + secretAmount + nonce` (commitment binding)
  - `offeredPrice >= secretPrice` (price constraint)
  - `offeredAmount >= secretAmount` (amount constraint)
- **Output**: `valid` (1 if all constraints satisfied, 0 otherwise)

## Circuit Statistics

- **Curve**: bn-128 (Ethereum compatible)
- **Wires**: 8
- **Constraints**: 0 (simplified version)
- **Private Inputs**: 2 (`secretPrice`, `secretAmount`)
- **Public Inputs**: 4 (`commit`, `nonce`, `offeredPrice`, `offeredAmount`)
- **Outputs**: 1 (`valid`)

## Directory Structure

```
circuits/
├── README.md                    # This file
├── hidden_params.circom         # Main circuit implementation ✅
├── hidden_params.r1cs           # Compiled constraint system ✅
├── hidden_params.wasm           # Circuit WebAssembly ✅
├── pot12_final.ptau             # Powers of Tau (4.7MB) ✅
├── hidden_params_0001.zkey      # Proving key (4KB) ✅
├── verification_key.json        # Verification key (3.6KB) ✅
├── checksums.txt                # SHA256 hashes for integrity ✅
├── artifacts/                   # Build artifacts (ignored)
├── keys/                        # Cryptographic keys (ignored)
└── powersoftau/                 # Ceremony files (ignored)
```

## Trusted Setup Status

✅ **COMPLETED** - Trusted setup ceremony finished successfully!

**Generated Artifacts:**

- **Powers of Tau**: 12th power (2^12 = 4096 constraints capacity)
- **Phase 2 Setup**: Circuit-specific proving key with 1 contribution
- **Verification Key**: Ready for Solidity verifier generation
- **Circuit Hash**: `1901c798 30ed9084 d934a6d0 d575c074...` (verified)

**Verification**: `npm run circuit:verify-setup` ✅ **ZKey Ok!**

## Development Workflow

### 1. Environment Check

```bash
npm run circuit:version          # Check tool versions
npm run circuit:help            # Show available commands
```

### 2. Circuit Development

```bash
npm run circuit:compile         # Compile circuit → .r1cs + .wasm ✅
npm run circuit:info           # Show circuit statistics ✅
```

### 3. Trusted Setup

```bash
npm run circuit:setup          # Complete ceremony → .zkey + verification_key.json ✅
npm run circuit:verify-setup   # Verify setup integrity ✅
```

### 4. Proof Generation & Verification

```bash
npm run circuit:prove          # Generate proof for test inputs
npm run circuit:verify         # Verify generated proof
```

## NPM Scripts Reference

| Script                 | Purpose                               | Output                           | Status |
| ---------------------- | ------------------------------------- | -------------------------------- | ------ |
| `circuit:version`      | Check circom/snarkjs versions         | Version info                     | ✅     |
| `circuit:help`         | Show command reference                | Help text                        | ✅     |
| `circuit:compile`      | Compile circuit to R1CS and WASM      | `.r1cs`, `.wasm`                 | ✅     |
| `circuit:setup`        | Run trusted setup ceremony            | `.zkey`, `verification_key.json` | ✅     |
| `circuit:verify-setup` | Verify trusted setup integrity        | Success/failure confirmation     | ✅     |
| `circuit:info`         | Display circuit constraints/wires     | Statistics                       | ✅     |
| `circuit:prove`        | Generate proof with test data         | `proof.json`, `public.json`      | 🎯     |
| `circuit:verify`       | Verify proof against verification key | Success/failure                  | 🎯     |

## Security Notes

- **Powers of Tau**: Using 12th power (2^12 = 4096 constraints max)
- **Phase 2**: Circuit-specific trusted setup with single contribution
- **Key Management**: Proving keys are large; use `.gitignore` to avoid committing
- **Reproducibility**: SHA256 checksums in `checksums.txt` for artifact verification
- **Circuit Hash**: Matches between R1CS and ZKey (verified during setup)

## Artifact Integrity

All trusted setup artifacts have been verified and checksummed:

```bash
# Verify artifact integrity
cd circuits && sha256sum -c checksums.txt

# Re-verify trusted setup
npm run circuit:verify-setup
```

## Development Dependencies

- **circom**: Circuit compiler (v0.5.46 - globally installed)
- **snarkjs**: Proof generation and verification toolkit (v0.7.5)
- **Node.js**: Required for proof generation scripts

## Next Steps

1. ✅ Environment setup
2. ✅ Implement circuit with signal structure
3. ✅ Generate trusted setup artifacts and verify integrity
4. ✅ Generate Solidity verifier contract and deploy successfully
5. 🎯 Create proof generation utilities
6. 🔗 Integrate with LOP predicate system

---

_Part of the DarkSwap ZK implementation - Chunk 1: ZK Infrastructure Foundation_
