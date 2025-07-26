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

## Directory Structure

```
circuits/
├── README.md                    # This file
├── hidden_params.circom         # Main circuit implementation
├── *.r1cs                       # Compiled constraint system (ignored)
├── *.wasm                       # Circuit WebAssembly (ignored)
├── *.ptau                       # Powers of Tau files (ignored)
├── *.zkey                       # Proving keys (ignored)
├── verification_key.json        # Verification key (ignored)
├── artifacts/                   # Build artifacts (ignored)
├── keys/                        # Cryptographic keys (ignored)
└── powersoftau/                 # Ceremony files (ignored)
```

## Development Workflow

### 1. Environment Check

```bash
npm run circuit:version          # Check tool versions
npm run circuit:help            # Show available commands
```

### 2. Circuit Development

```bash
npm run circuit:compile         # Compile circuit → .r1cs + .wasm
npm run circuit:info           # Show circuit statistics
```

### 3. Trusted Setup

```bash
npm run circuit:setup          # Complete ceremony → .zkey + verification_key.json
```

### 4. Proof Generation & Verification

```bash
npm run circuit:prove          # Generate proof for test inputs
npm run circuit:verify         # Verify generated proof
```

## NPM Scripts Reference

| Script            | Purpose                               | Output                           |
| ----------------- | ------------------------------------- | -------------------------------- |
| `circuit:version` | Check circom/snarkjs versions         | Version info                     |
| `circuit:help`    | Show command reference                | Help text                        |
| `circuit:compile` | Compile circuit to R1CS and WASM      | `.r1cs`, `.wasm`                 |
| `circuit:setup`   | Run trusted setup ceremony            | `.zkey`, `verification_key.json` |
| `circuit:info`    | Display circuit constraints/wires     | Statistics                       |
| `circuit:prove`   | Generate proof with test data         | `proof.json`, `public.json`      |
| `circuit:verify`  | Verify proof against verification key | Success/failure                  |

## Security Notes

- **Powers of Tau**: Using 12th power (2^12 = 4096 constraints max)
- **Phase 2**: Circuit-specific trusted setup with single contribution
- **Key Management**: Proving keys are large; use `.gitignore` to avoid committing
- **Reproducibility**: All ceremony parameters are deterministic for testing

## Development Dependencies

- **circom**: Circuit compiler (v2.1.8+)
- **snarkjs**: Proof generation and verification toolkit (v0.7.4+)
- **Node.js**: Required for proof generation scripts

## Next Steps

1. ✅ Environment setup (this commit)
2. 🎯 Implement `hidden_params.circom` circuit
3. 🔧 Generate trusted setup artifacts
4. 🧪 Create proof generation utilities
5. 🔗 Integrate with Solidity verifier

---

_Part of the DarkSwap ZK implementation - Chunk 1: ZK Infrastructure Foundation_
