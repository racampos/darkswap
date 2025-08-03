# DarkSwap - Privacy-Preserving DEX

**The first decentralized exchange with cryptographically private limit orders.**

DarkSwap enables traders to hide their true price requirements from MEV bots, frontrunners, and market manipulators using zero-knowledge proofs. Set public "decoy" prices while keeping your real minimum requirements secret—get better execution without revealing your trading strategy.

## The Problem with Current DEXs

**Transparent Order Books** expose your trading intentions:

- MEV bots sandwich your trades for profit
- Frontrunners steal your alpha by copying strategies
- Market makers adjust prices when they see large orders coming
- You never get the best possible execution

**DarkSwap solves this with cryptographic privacy.**

## How DarkSwap Works

### **Hidden Constraints**

Create orders with **secret minimum requirements** that only you know:

- **Public Price**: What the market sees (e.g., "2000 USDC per WETH")
- **Secret Price**: Your actual minimum (e.g., "2100 USDC per WETH")
- **Secret Amount**: Minimum fill size you'll accept

### ⚡ **Zero-Knowledge Verification**

Your secrets are cryptographically hidden using **Poseidon commitments**:

- Takers can't see your real requirements
- ZK proofs validate fills without revealing secrets
- Failed attempts leak zero information
- Only successful fills reveal the existence of constraints

### **Better Execution**

Get superior trading outcomes:

- **No frontrunning** - bots can't predict your moves
- **No sandwich attacks** - your true price is hidden
- **Better fills** - potentially exceed your public price
- **Strategic flexibility** - adapt to market conditions privately

## Key Features

### **Privacy by Default**

- **Secret Requirements**: Hidden price and amount thresholds
- **MEV Protection**: Immune to sandwich attacks and frontrunning
- **Zero Leakage**: Failed fills reveal nothing about your constraints
- **Cryptographic Security**: Powered by zero-knowledge proofs

### **Professional Trading**

- **Advanced Orders**: Set complex private conditions
- **Real-time Execution**: Instant ZK proof generation
- **Better Prices**: Exceed your public limits privately
- **Partial Fills**: Flexible execution with hidden minimums

### **Built on Proven Infrastructure**

- **1inch Integration**: Leverages battle-tested DEX infrastructure
- **Gas Efficient**: Minimal overhead for privacy features
- **Wide Compatibility**: Works with existing wallets and tools
- **Production Ready**: Professional-grade architecture

## Getting Started

### Quick Demo

```shell
# Install dependencies
npm install

# Run the full workflow demo (without real on-chain transactions)
npm run demo:full-workflow

# Test the full workflow (with real on-chain ZKP validation)
npm run demo:full-execution
```

### Web Interface

```shell
# Start the maker interface
cd frontend && npm install && npm run dev
```

Visit `http://localhost:3000/maker` to create your first private order.

## Use Cases

### **MEV Protection**

Trade large amounts without telegraphing your intentions to extractors.

### **Strategy Privacy**

Keep your trading algorithms and price targets confidential.

### **Improved Execution**

Get better fills by hiding your true willingness to pay.

### **Professional Trading**

Institutional-grade privacy for sophisticated market participants.

## Technical Innovation

DarkSwap introduces several groundbreaking technologies:

- **Zero-Knowledge Limit Orders**: First implementation of cryptographically private DEX orders
- **Poseidon Commitments**: Efficiently hide trading parameters in order metadata
- **On-Demand Proofs**: Generate ZK proofs only when needed for gas efficiency
- **Seamless Integration**: Works with existing 1inch infrastructure

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Create Order  │    │  Taker Discovers │    │  ZK Verification│
│  with Secrets   │ ──▶│  Public Order    │ ──▶│  & Execution    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   Commitment Hash         Standard 1inch          Groth16 Proof
   in Order Salt           Order Discovery         + Smart Contract
```

## Project Structure

```
├── contracts/           # Smart contracts for ZK verification
├── circuits/           # Zero-knowledge proof circuits
├── src/               # Core privacy-preserving order logic
├── frontend/          # Web interface for traders
├── test/             # Comprehensive test suites
└── scripts/          # Demo and deployment scripts
```

## Why DarkSwap Matters

**Current DEXs are broken for serious traders.** Every order is public, every strategy is visible, and MEV extractors profit from your information.

**DarkSwap fixes this fundamentally.** For the first time, you can trade with institutional-grade privacy while maintaining the trustlessness and composability of DeFi.

**This isn't just an incremental improvement—it's a paradigm shift toward truly private decentralized trading.**

---

_Built with zero-knowledge proofs, powered by 1inch infrastructure, designed for the future of private DeFi._
