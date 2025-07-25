/**
 * Order utilities adapted from JavaScript to TypeScript
 * Original source: https://github.com/1inch/limit-order-protocol/blob/4.3.2/test/helpers/orderUtils.js
 */

import { ethers } from "hardhat";
import { setn, trim0x } from "./utils";

export const Order = [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'makerAsset', type: 'address' },
    { name: 'takerAsset', type: 'address' },
    { name: 'makingAmount', type: 'uint256' },
    { name: 'takingAmount', type: 'uint256' },
    { name: 'makerTraits', type: 'uint256' },
];

export const ABIOrder = {
    type: 'tuple',
    name: 'order',
    components: Order,
};

export interface OrderStruct {
    salt: bigint;
    maker: string;
    receiver: string;
    makerAsset: string;
    takerAsset: string;
    makingAmount: bigint;
    takingAmount: bigint;
    makerTraits: bigint;
    extension?: string;
}

export const name = '1inch Aggregation Router';
export const version = '6';

const _NO_PARTIAL_FILLS_FLAG = 255n;
const _ALLOW_MULTIPLE_FILLS_FLAG = 254n;
const _NEED_PREINTERACTION_FLAG = 252n;
const _NEED_POSTINTERACTION_FLAG = 251n;
const _NEED_EPOCH_CHECK_FLAG = 250n;
const _HAS_EXTENSION_FLAG = 249n;
const _USE_PERMIT2_FLAG = 248n;
const _UNWRAP_WETH_FLAG = 247n;

export const TakerTraitsConstants = {
    _MAKER_AMOUNT_FLAG: 1n << 255n,
    _UNWRAP_WETH_FLAG: 1n << 254n,
    _SKIP_ORDER_PERMIT_FLAG: 1n << 253n,
    _USE_PERMIT2_FLAG: 1n << 252n,
    _ARGS_HAS_TARGET: 1n << 251n,

    _ARGS_EXTENSION_LENGTH_OFFSET: 224n,
    _ARGS_EXTENSION_LENGTH_MASK: 0xffffff,
    _ARGS_INTERACTION_LENGTH_OFFSET: 200n,
    _ARGS_INTERACTION_LENGTH_MASK: 0xffffff,
};

export function buildTakerTraits({
    makingAmount = false,
    unwrapWeth = false,
    skipMakerPermit = false,
    usePermit2 = false,
    target = '0x',
    extension = '0x',
    interaction = '0x',
    threshold = 0n,
} = {}) {
    return {
        traits: BigInt(threshold) | (
            (makingAmount ? TakerTraitsConstants._MAKER_AMOUNT_FLAG : 0n) |
            (unwrapWeth ? TakerTraitsConstants._UNWRAP_WETH_FLAG : 0n) |
            (skipMakerPermit ? TakerTraitsConstants._SKIP_ORDER_PERMIT_FLAG : 0n) |
            (usePermit2 ? TakerTraitsConstants._USE_PERMIT2_FLAG : 0n) |
            (trim0x(target).length > 0 ? TakerTraitsConstants._ARGS_HAS_TARGET : 0n) |
            (BigInt(trim0x(extension).length / 2) << TakerTraitsConstants._ARGS_EXTENSION_LENGTH_OFFSET) |
            (BigInt(trim0x(interaction).length / 2) << TakerTraitsConstants._ARGS_INTERACTION_LENGTH_OFFSET)
        ),
        args: ethers.solidityPacked(
            ['bytes', 'bytes', 'bytes'],
            [target, extension, interaction],
        ),
    };
}

export function buildMakerTraitsRFQ({
    allowedSender = ethers.ZeroAddress,
    shouldCheckEpoch = false,
    allowPartialFill = true,
    usePermit2 = false,
    unwrapWeth = false,
    expiry = 0,
    nonce = 0,
    series = 0,
} = {}) {
    return buildMakerTraits({
        allowedSender,
        shouldCheckEpoch,
        allowPartialFill,
        allowMultipleFills: false,
        usePermit2,
        unwrapWeth,
        expiry,
        nonce,
        series,
    });
}

export function buildMakerTraits({
    allowedSender = ethers.ZeroAddress,
    shouldCheckEpoch = false,
    allowPartialFill = true,
    allowMultipleFills = true,
    usePermit2 = false,
    unwrapWeth = false,
    expiry = 0,
    nonce = 0,
    series = 0,
} = {}) {
    if (BigInt(expiry) < 0n || BigInt(expiry) >= (1n << 40n)) {
        throw new Error('Expiry should be less than 40 bits');
    }
    if (BigInt(nonce) < 0 || BigInt(nonce) >= (1n << 40n)) {
        throw new Error('Nonce should be less than 40 bits');
    }
    if (BigInt(series) < 0 || BigInt(series) >= (1n << 40n)) {
        throw new Error('Series should be less than 40 bits');
    }

    return '0x' + (
        (BigInt(series) << 160n) |
        (BigInt(nonce) << 120n) |
        (BigInt(expiry) << 80n) |
        (BigInt(allowedSender) & ((1n << 80n) - 1n)) |
        setn(0n, _UNWRAP_WETH_FLAG, unwrapWeth) |
        setn(0n, _ALLOW_MULTIPLE_FILLS_FLAG, allowMultipleFills) |
        setn(0n, _NO_PARTIAL_FILLS_FLAG, !allowPartialFill) |
        setn(0n, _NEED_EPOCH_CHECK_FLAG, shouldCheckEpoch) |
        setn(0n, _USE_PERMIT2_FLAG, usePermit2)
    ).toString(16).padStart(64, '0');
}

export function buildFeeTakerExtensions({
    feeTaker,
    getterExtraPrefix = '0x',
    integratorFeeRecipient = ethers.ZeroAddress,
    protocolFeeRecipient = ethers.ZeroAddress,
    makerReceiver = undefined,
    integratorFee = 0,
    integratorShare = 50,
    resolverFee = 0,
    whitelistDiscount = 50,
    whitelist = '0x00',
    whitelistPostInteraction = whitelist,
    customMakingGetter = '0x',
    customTakingGetter = '0x',
    customPostInteraction = '0x',
}: {
    feeTaker: string;
    getterExtraPrefix?: string;
    integratorFeeRecipient?: string;
    protocolFeeRecipient?: string;
    makerReceiver?: string;
    integratorFee?: number;
    integratorShare?: number;
    resolverFee?: number;
    whitelistDiscount?: number;
    whitelist?: string;
    whitelistPostInteraction?: string;
    customMakingGetter?: string;
    customTakingGetter?: string;
    customPostInteraction?: string;
}) {
    return {
        makingAmountData: ethers.solidityPacked(
            ['address', 'bytes', 'uint16', 'uint8', 'uint16', 'uint8', 'bytes', 'bytes'],
            [feeTaker, getterExtraPrefix, integratorFee, integratorShare, resolverFee, whitelistDiscount, whitelist, customMakingGetter],
        ),
        takingAmountData: ethers.solidityPacked(
            ['address', 'bytes', 'uint16', 'uint8', 'uint16', 'uint8', 'bytes', 'bytes'],
            [feeTaker, getterExtraPrefix, integratorFee, integratorShare, resolverFee, whitelistDiscount, whitelist, customTakingGetter],
        ),
        postInteraction: ethers.solidityPacked(
            (['address', 'bytes1', 'address', 'address'] as string[]).concat(
                makerReceiver ? ['address'] : [],
                ['uint16', 'uint8', 'uint16', 'uint8', 'bytes', 'bytes'],
            ),
            ([feeTaker, makerReceiver ? '0x01' : '0x00', integratorFeeRecipient, protocolFeeRecipient] as any[]).concat(
                makerReceiver ? [makerReceiver] : [],
                [integratorFee, integratorShare, resolverFee, whitelistDiscount, whitelistPostInteraction, customPostInteraction],
            ),
        ),
    };
}

export function buildOrderRFQ(
    {
        maker,
        receiver = ethers.ZeroAddress,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        makerTraits = '0',
    }: {
        maker: string;
        receiver?: string;
        makerAsset: string;
        takerAsset: string;
        makingAmount: bigint;
        takingAmount: bigint;
        makerTraits?: string;
    },
    {
        makerAssetSuffix = '0x',
        takerAssetSuffix = '0x',
        makingAmountData = '0x',
        takingAmountData = '0x',
        predicate = '0x',
        permit = '0x',
        preInteraction = '0x',
        postInteraction = '0x',
    } = {},
) {
    let updatedMakerTraits = '0x' + setn(BigInt(makerTraits), _ALLOW_MULTIPLE_FILLS_FLAG, false).toString(16).padStart(64, '0');
    updatedMakerTraits = '0x' + setn(BigInt(updatedMakerTraits), _NO_PARTIAL_FILLS_FLAG, false).toString(16).padStart(64, '0');
    updatedMakerTraits = '0x' + setn(BigInt(updatedMakerTraits), _NEED_EPOCH_CHECK_FLAG, false).toString(16).padStart(64, '0');

    return buildOrder(
        {
            maker,
            receiver,
            makerAsset,
            takerAsset,
            makingAmount,
            takingAmount,
            makerTraits: updatedMakerTraits,
        },
        {
            makerAssetSuffix,
            takerAssetSuffix,
            makingAmountData,
            takingAmountData,
            predicate,
            permit,
            preInteraction,
            postInteraction,
        },
    );
}

/**
 * Build a limit order with optional extension support.
 * 
 * Note: The `salt` parameter was added for testing needs to allow custom salts
 * for test isolation (e.g., `BigInt(Date.now() + nonce)`).
 * 
 * Salt behavior:
 * - If salt provided: Uses the custom salt value
 * - If no salt: Defaults to BigInt('1') 
 * - If extension present: Overrides with extension hash
 */
export function buildOrder(
    {
        maker,
        receiver = ethers.ZeroAddress,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        makerTraits = buildMakerTraits(),
        salt,
    }: {
        maker: string;
        receiver?: string;
        makerAsset: string;
        takerAsset: string;
        makingAmount: bigint;
        takingAmount: bigint;
        makerTraits?: string;
        salt?: bigint;
    },
    {
        makerAssetSuffix = '0x',
        takerAssetSuffix = '0x',
        makingAmountData = '0x',
        takingAmountData = '0x',
        predicate = '0x',
        permit = '0x',
        preInteraction = '0x',
        postInteraction = '0x',
        customData = '0x',
    } = {},
): OrderStruct & { extension: string } {
    const allInteractions = [
        makerAssetSuffix,
        takerAssetSuffix,
        makingAmountData,
        takingAmountData,
        predicate,
        permit,
        preInteraction,
        postInteraction,
    ];

    const allInteractionsConcat = allInteractions.map(trim0x).join('') + trim0x(customData);

    // https://stackoverflow.com/a/55261098/440168
    const cumulativeSum = (sum => (value: number) => { sum += value; return sum; })(0);
    const offsets = allInteractions
        .map(a => a.length / 2 - 1)
        .map(cumulativeSum)
        .reduce((acc: bigint, a: number, i: number) => acc + (BigInt(a) << BigInt(32 * i)), 0n);

    let extension = '0x';
    if (allInteractionsConcat.length > 0) {
        extension += offsets.toString(16).padStart(64, '0') + allInteractionsConcat;
    }

    let finalSalt = salt || BigInt('1');
    let updatedMakerTraits = BigInt(makerTraits);
    if (trim0x(extension).length > 0) {
        finalSalt = BigInt(ethers.keccak256(extension)) & ((1n << 160n) - 1n); // Use 160 bit of extension hash
        updatedMakerTraits = updatedMakerTraits | (1n << _HAS_EXTENSION_FLAG);
    }

    if (trim0x(preInteraction).length > 0) {
        updatedMakerTraits = updatedMakerTraits | (1n << _NEED_PREINTERACTION_FLAG);
    }

    if (trim0x(postInteraction).length > 0) {
        updatedMakerTraits = updatedMakerTraits | (1n << _NEED_POSTINTERACTION_FLAG);
    }

    return {
        salt: finalSalt,
        maker,
        receiver,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        makerTraits: updatedMakerTraits,
        extension,
    };
}

export function buildOrderData(chainId: bigint, verifyingContract: string, order: OrderStruct) {
    return {
        domain: { name, version, chainId, verifyingContract },
        types: { Order },
        value: order,
    };
}

export async function signOrder(order: OrderStruct, chainId: bigint, target: string, wallet: any) {
    const orderData = buildOrderData(chainId, target, order);
    return await wallet.signTypedData(orderData.domain, orderData.types, orderData.value);
}

export function fillWithMakingAmount(amount: bigint) {
    return BigInt(amount) | BigInt(buildTakerTraits({ makingAmount: true }).traits);
}

export function unwrapWethTaker(amount: bigint) {
    return BigInt(amount) | BigInt(buildTakerTraits({ unwrapWeth: true }).traits);
}

export function skipMakerPermit(amount: bigint) {
    return BigInt(amount) | BigInt(buildTakerTraits({ skipMakerPermit: true }).traits);
}