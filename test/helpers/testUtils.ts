/**
 * General testing utilities for the 1inch LOP test suite
 */

// Helper to format token balances for readable output
export function formatBalance(amount: bigint, decimals: number, symbol: string): string {
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    
    if (fractionalPart === 0n) {
        return `${wholePart.toString()} ${symbol}`;
    } else {
        const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
        return `${wholePart.toString()}.${fractionalStr} ${symbol}`;
    }
} 