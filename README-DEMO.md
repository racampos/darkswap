# DarkSwap Demo Instructions

**Privacy-Preserving DEX with Zero-Knowledge Hidden Constraints**

DarkSwap enables makers to create limit orders with hidden price/amount constraints that are enforced cryptographically without revealing the constraints on-chain.

## What This Demo Shows

- **Privacy-preserving orders**: Makers set secret minimum constraints never revealed
- **ZK proof authorization**: Takers get proofs only if they meet hidden requirements
- **Real 1inch integration**: Orders execute on actual 1inch router (forked mainnet)
- **End-to-end workflow**: Complete maker → REST API → taker → on-chain execution

## Quick Demo (5 minutes)

### Prerequisites

```bash
git clone <repository>
cd darkswap
npm install
```

### Terminal Setup

**Terminal 1: Hardhat Node** (keep running)

```bash
npx hardhat node --fork https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
```

**Terminal 2: Commands** (run sequentially)

```bash
# 1. Deploy contracts
npx hardhat run scripts/deploy.ts --network localhost

# 2. Start maker REST API service
npx hardhat run scripts/runMakerService.ts --network localhost
```

**Terminal 3: Demo Execution** (after API is running)

```bash
# 3. Maker publishes order with hidden constraints
npx hardhat run scripts/makerPublish.ts --network localhost

# 4. Taker discovers and fills order (if constraints satisfied)
npx hardhat run scripts/takerDiscover.ts --network localhost
```

## Expected Output

### Step 1: Contract Deployment

```
Deploying contracts to localhost network...
Groth16Verifier deployed: 0x...
HiddenParamPredicateZK deployed: 0x...
Addresses saved to config/deployed-addresses.json
```

### Step 2: API Service

```
Starting DarkSwap Maker Service
Port: 3000
Network configuration validated
MakerService initialized successfully
Loading published orders from storage...
Server started successfully on port 3000
```

### Step 3: Maker Publishing Order

```
DARKSWAP MAKER PUBLISHING WORKFLOW
Order Creation: 2.0 WETH → 7200.0 USDC (3600 USDC per WETH)
Hidden Constraints: 6000 USDC minimum (never revealed on-chain)
Order published to storage with ID: order_abc123_xyz789
```

### Step 4: Taker Execution

```
DARKSWAP TAKER DISCOVERY & EXECUTION WORKFLOW
Found 1 matching orders
Selected cheapest order
API Authorization: ✅ Authorization granted (ZK proof generated)
On-Chain Execution: ✅ Transaction confirmed in block 12345678
TRADE COMPLETED: 2.0 WETH received for 7200.0 USDC
```

## Architecture Overview

```
┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Maker     │    │   REST API      │    │     Taker       │
│  publishes  │───▶│   ZK Service    │◀───│   discovers     │
│   orders    │    │                 │    │    orders       │
└─────────────┘    └─────────────────┘    └─────────────────┘
       │                     │                        │
       │            ┌─────────────────┐                │
       └───────────▶│  JSON Storage   │◀───────────────┘
                    │ published_orders │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │  1inch Router   │
                    │ (Forked Mainnet)│
                    └─────────────────┘
```

### Key Components

1. **Commitment Orders**: Orders with Poseidon commitments to hidden constraints
2. **ZK Proof Generation**: On-demand proof creation when takers request fills
3. **REST API Authorization**: Validates fill amounts against secret constraints
4. **1inch Integration**: Real DEX execution on forked mainnet
5. **Order Storage**: JSON-based persistence with thread-safe operations

## Technical Details

### Hidden Constraints

- **Secret Price**: Minimum total USDC the maker will accept
- **Secret Amount**: Minimum USDC amount for any single fill
- **Commitment**: Poseidon hash embedded in order salt
- **ZK Proof**: Generated only if taker's amount satisfies both constraints

### Order Lifecycle

1. **Maker** creates order with commitment to secret constraints
2. **Maker** publishes order to discoverable storage
3. **Taker** finds order and requests fill authorization
4. **API Service** generates ZK proof if constraints satisfied
5. **Taker** executes order on-chain with proof
6. **Smart Contract** verifies proof and processes trade

### Privacy Properties

- Secret constraints never revealed on-chain
- Failed authorization attempts reveal nothing
- Only successful fills prove constraint satisfaction
- Standard 1inch order format (privacy-preserving extension)

## Troubleshooting

### Common Issues

**"Cannot connect to localhost"**

- Ensure Hardhat node is running in Terminal 1
- Check it's forking mainnet successfully

**"API health check failed"**

- Ensure API service started successfully in Terminal 2
- Check port 3000 is not in use

**"No orders found"**

- Run makerPublish.ts first to create orders
- Check `storage/published_orders.json` exists

**"Transaction reverted"**

- Ensure sufficient token balances (automated in scripts)
- Check ZK proof generation succeeded

### Reset Demo State

```bash
# Clear published orders
echo '{"orders":[],"lastUpdated":"","version":"1.0.0"}' > storage/published_orders.json

# Restart Hardhat node (Terminal 1)
# Ctrl+C, then restart: npx hardhat node --fork <URL>
```

## Demo Scenarios

### Scenario 1: Successful Fill (Default)

- Taker requests 7200 USDC fill
- Meets hidden 6000 USDC minimum
- ✅ Authorization granted, trade executes

### Scenario 2: Insufficient Amount (Manual Test)

```bash
# Modify takerDiscover.ts fillAmount to below minimum
# fillAmount = BigInt("5000000000") // 5000 USDC < 6000 minimum
# ❌ Authorization denied, privacy preserved
```

### Scenario 3: Multiple Orders

```bash
# Run makerPublish.ts multiple times
# Different orders with different constraints
# Taker can discover and choose optimal order
```

## Key Innovation

**Privacy-Preserving Limit Orders**: For the first time, DEX orders can have **hidden constraints** that are cryptographically enforced without revealing sensitive trading information on-chain. This enables sophisticated trading strategies while maintaining privacy.

## Next Steps

- **Web Frontend**: React interface with Metamask integration (coming soon!)
- **Advanced Constraints**: Time-based, volume-based conditions
- **Mainnet Deployment**: Production-ready contracts and infrastructure
- **Mobile Interface**: Native app with built-in wallet support
