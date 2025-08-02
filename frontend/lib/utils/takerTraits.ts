/**
 * Taker traits utility for 1inch order execution
 * Simplified version based on the pattern from demoFullExecution.ts
 */

export interface TakerTraitsData {
  traits: string
  args: string
}

export interface BuildTakerTraitsParams {
  makingAmount?: boolean
  unwrapWeth?: boolean
  skipMakerPermit?: boolean
  usePermit2?: boolean
  target?: string
  extension?: string
  interaction?: string
  threshold?: bigint
}

// Constants from test/helpers/orderUtils.ts
export const TakerTraitsConstants = {
  _MAKER_AMOUNT_FLAG: BigInt(1) << BigInt(255),
  _UNWRAP_WETH_FLAG: BigInt(1) << BigInt(254),
  _SKIP_ORDER_PERMIT_FLAG: BigInt(1) << BigInt(253),
  _USE_PERMIT2_FLAG: BigInt(1) << BigInt(252),
  _ARGS_HAS_TARGET: BigInt(1) << BigInt(251),

  _ARGS_EXTENSION_LENGTH_OFFSET: BigInt(224),
  _ARGS_EXTENSION_LENGTH_MASK: 0xffffff,
  _ARGS_INTERACTION_LENGTH_OFFSET: BigInt(200),
  _ARGS_INTERACTION_LENGTH_MASK: 0xffffff,
}

// Helper function to trim 0x prefix
function trim0x(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value
}

// Exact implementation from test/helpers/orderUtils.ts
export function buildTakerTraits({
  makingAmount = false,
  unwrapWeth = false,
  skipMakerPermit = false,
  usePermit2 = false,
  target = '0x',
  extension = '0x',
  interaction = '0x',
  threshold = BigInt(0),
}: BuildTakerTraitsParams = {}): TakerTraitsData {
  const traits = BigInt(threshold) | (
    (makingAmount ? TakerTraitsConstants._MAKER_AMOUNT_FLAG : BigInt(0)) |
    (unwrapWeth ? TakerTraitsConstants._UNWRAP_WETH_FLAG : BigInt(0)) |
    (skipMakerPermit ? TakerTraitsConstants._SKIP_ORDER_PERMIT_FLAG : BigInt(0)) |
    (usePermit2 ? TakerTraitsConstants._USE_PERMIT2_FLAG : BigInt(0)) |
    (trim0x(target).length > 0 ? TakerTraitsConstants._ARGS_HAS_TARGET : BigInt(0)) |
    (BigInt(trim0x(extension).length / 2) << TakerTraitsConstants._ARGS_EXTENSION_LENGTH_OFFSET) |
    (BigInt(trim0x(interaction).length / 2) << TakerTraitsConstants._ARGS_INTERACTION_LENGTH_OFFSET)
  )

  // Use viem's equivalent of ethers.solidityPacked
  // This packs [target, extension, interaction] as bytes
  const packedArgs = packArgs(target, extension, interaction)

  return {
    traits: '0x' + traits.toString(16),
    args: packedArgs,
  }
}

// Simple packing function (mimicking ethers.solidityPacked for bytes)
function packArgs(target: string, extension: string, interaction: string): string {
  // Remove 0x prefix and ensure even length
  const cleanTarget = trim0x(target).padStart(trim0x(target).length + (trim0x(target).length % 2), '0')
  const cleanExtension = trim0x(extension).padStart(trim0x(extension).length + (trim0x(extension).length % 2), '0')
  const cleanInteraction = trim0x(interaction).padStart(trim0x(interaction).length + (trim0x(interaction).length % 2), '0')
  
  return '0x' + cleanTarget + cleanExtension + cleanInteraction
}

export function hasExtension(orderWithExtension: any): boolean {
  return !!(orderWithExtension?.extension && orderWithExtension.extension !== '0x')
}

export function extractExtension(orderWithExtension: any): string {
  return orderWithExtension?.extension || '0x'
} 