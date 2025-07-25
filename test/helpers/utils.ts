/**
 * Utility functions adapted from JavaScript to TypeScript
 * Original source: https://github.com/1inch/limit-order-protocol/blob/4.3.2/test/helpers/utils.js
 */

import { parseUnits } from 'ethers';

export function calculateGasUsed(trace: any, address: string): number {
    // Count gas used by all calls to our contract
    const totalGasUsed = flattenTree([trace])
        .filter((t: any) => t.opcode === 'CALL' && t.params.to.toLowerCase() === address.toLowerCase())
        .reduce((acc: number, t: any) => { acc += t.params.gasUsed; return acc; }, 0);

    // Count gas used by our contract calls and staticcalls (and not to itself)
    const totalSubtract = flattenTree([trace])
        .filter((t: any) => t.opcode === 'CALL' && t.params.from.toLowerCase() === address.toLowerCase() && t.params.to.toLowerCase() !== address.toLowerCase())
        .reduce((acc: number, t: any) => { acc += t.params.gasUsed; return acc; }, 0);

    return calldataCost(trace.params.inputData) + totalGasUsed - totalSubtract;
}

export function calldataCost(calldata: string): number {
    const trimmed = trim0x(calldata);
    const zeroCount = trimmed.match(/.{2}/g)?.filter(x => x === '00').length || 0;
    const nonZeroCount = trimmed.length / 2 - zeroCount;
    return zeroCount * 4 + nonZeroCount * 16;
}

// findTrace(tracer, 'CALL', exchange.address)
export function findTrace(tracer: any, opcode: string, address: string): any {
    return tracer.recorder.previousTraces.filter(
        (tr: any) => tr.top.opcode === opcode && tr.top.params.to.toLowerCase() === address.toLowerCase(),
    ).slice(-1)[0].top;
}

// TODO: refactor to get sigle trace as input
/// const allTraces = flattenTree([trace]);
export const flattenTree = (arr: any[]): any[] => arr.flatMap(item => [item, ...flattenTree(item.children || [])]);

// expect(countAllItems(['a','b','c','a','b','b'])).to.contain({a: 2, b: 3, c: 1});
export const countAllItems = (items: any[]): Record<string, number> => items.reduce((acc: Record<string, number>, item: any) => { acc[item] = (acc[item] || 0) + 1; return acc; }, {});

// console.log(JSON.stringify(treeForEach(trace, tr => tr.children, tr => { delete tr.parent })))
export function treeForEach(element: any, unnest: (el: any) => any[], action: (el: any) => void): any {
    action(element);
    for (const item of unnest(element) || []) {
        treeForEach(item, unnest, action);
    }
    return element;
}

export function price(val: string): string {
    return ether(val).toString();
}

export function trim0x(bigNumber: string | number | bigint): string {
    const s = bigNumber.toString();
    if (s.startsWith('0x')) {
        return s.substring(2);
    }
    return s;
}

export function cutSelector(data: string): string {
    const hexPrefix = '0x';
    return hexPrefix + data.substring(hexPrefix.length + 8);
}

export function getSelector(data: string): string {
    const hexPrefix = '0x';
    return data.substring(0, hexPrefix.length + 8);
}

export function joinStaticCalls(dataArray: string[]): { offsets: bigint; data: string } {
    const trimmed = dataArray.map(trim0x);
    const cumulativeSum = (sum => (value: number) => { sum += value; return sum; })(0);
    return {
        offsets: trimmed
            .map(d => d.length / 2)
            .map(cumulativeSum)
            .reduce((acc, val, i) => acc | BigInt(val) << BigInt(32 * i), 0n),
        data: '0x' + trimmed.join(''),
    };
}

export function ether(num: string): bigint {
    return parseUnits(num);
}

export function setn(num: bigint | string | number, bit: bigint | number, value: boolean): bigint {
    if (value) {
        return BigInt(num) | (1n << BigInt(bit));
    } else {
        return BigInt(num) & (~(1n << BigInt(bit)));
    }
}