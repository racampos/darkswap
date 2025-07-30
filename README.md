# DarkSwap - ZK Commitment Orders with REST Architecture

A zero-knowledge implementation for the 1inch Limit Order Protocol that enables makers to create orders with cryptographically hidden price thresholds using an elegant REST-based architecture.

## Architecture Overview

**Core Innovation**: Orders contain Poseidon commitments to secret parameters in their salt. Makers run REST services that generate ZK proofs on-demand for valid fills, providing clean separation between order discovery and authorization.

### How It Works

1. **Maker**: Creates clean 1inch orders with commitments embedded in salt
2. **Publication**: Orders appear as normal 1inch orders (no visible ZK complexity)
3. **Taker Discovery**: Takers find orders through standard 1inch infrastructure
4. **Fill Authorization**: Takers call maker's REST service with proposed fill amount
5. **ZK Verification**: Service generates proof if fill meets secret constraints
6. **Execution**: Taker receives ready-to-submit transaction with ZK proof

## Features

- **Clean Orders**: Standard 1inch orders with no complex extensions
- **Hidden Constraints**: Secret price/amount thresholds protected by ZK proofs
- **REST Architecture**: Maker-controlled authorization services
- **Elegant Integration**: Seamless client-side ZK workflow
- **Real-time Validation**: Proofs generated on-demand for actual fill amounts
- **Privacy Preservation**: Secrets never leak, even on rejection

## Quick Start

```shell
# Install dependencies
npm install

# Compile contracts (including ZK verifier)
npx hardhat compile

# Run commitment order tests
npx hardhat test test/CommitmentOrders.test.ts

# Run all tests
npx hardhat test

# Compile ZK circuits
npm run circuit:compile

# Run trusted setup
npm run circuit:setup
```

## Project Structure

```
├── src/utils/
│   ├── commitmentOrders.ts     # Simple order creation with commitments
│   ├── commitmentUtils.ts      # Poseidon commitment calculation
│   └── proofGenerator.ts       # ZK proof generation (for REST service)
├── circuits/
│   ├── hidden_params.circom    # ZK circuit for threshold validation
│   └── keys/                   # Trusted setup artifacts
├── contracts/
│   ├── Groth16Verifier.sol     # On-chain ZK verifier
│   └── HiddenParamPredicateZK.sol # Predicate adapter for 1inch integration
└── test/
    ├── CommitmentOrders.test.ts # Core commitment order functionality
    ├── GeneralFunctionality.test.ts # Basic 1inch integration
    └── PredicateExtensions.test.ts  # ZK predicate validation
```

## Test Suites

- **Commitment Orders**: Core functionality for simple orders with commitments
- **General Functionality**: Basic 1inch order creation, signing, and filling
- **Predicate Extensions**: ZK proof validation and threshold enforcement
- **ZK Infrastructure**: Circuit compilation, trusted setup, and verification

## Environment Setup

Create a `.env` file with your Alchemy mainnet URL:

```
ALCHEMY_MAINNET_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
```

## Key Benefits

- **Clean Architecture**: Elegant separation between discovery and authorization
- **Standard Integration**: Works with existing 1inch infrastructure
- **Maker Control**: REST services provide flexibility and DoS protection
- **Privacy by Design**: Secrets cryptographically protected
- **Production Ready**: Professional architecture suitable for real deployment
