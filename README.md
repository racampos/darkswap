# DarkSwap - 1inch Limit Order Protocol Predicate Testing

This project demonstrates advanced integration with the 1inch Limit Order Protocol v4, specifically focusing on predicate extensions for conditional order execution.

## Features

- **Simple Predicate Testing**: Basic equality checks and condition validation
- **Complex Predicate Logic**: OR/AND conditions with multiple checks using `joinStaticCalls`
- **Real-time State Validation**: Dynamic on-chain condition evaluation
- **Production-Ready Error Handling**: Proper `PredicateIsNotTrue` error validation
- **Gas-Efficient Implementation**: Optimized predicate execution (~158k gas)
- **Type-Safe Development**: Full TypeScript support with Hardhat toolbox

## Quick Start

```shell
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run all tests
npx hardhat test

# Run specific test suites
npx hardhat test --grep "General Functionality"
npx hardhat test --grep "Predicate Extensions"

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

## Test Coverage

- **General Functionality**: Basic order creation, signing, and filling
- **Predicate Infrastructure**: Contract deployment and state management
- **Predicate Rejection**: Order blocking when conditions are false
- **Predicate Success**: Order execution when conditions are true
- **Complex Predicates**: Multi-condition OR logic with advanced calldata composition

## Environment Setup

Create a `.env` file with your Alchemy mainnet URL:

```
ALCHEMY_MAINNET_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
```
