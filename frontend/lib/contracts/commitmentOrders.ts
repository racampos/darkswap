import { keccak256, stringToBytes, isAddress } from 'viem'
import { calculateCommitment } from '../utils/commitment'

/**
 * Commitment order parameter interfaces (frontend versions)
 */
export interface CommitmentOrderParams {
  maker: `0x${string}`
  makerAsset: `0x${string}`
  takerAsset: `0x${string}`
  makingAmount: bigint
  takingAmount: bigint
  secretParams: {
    secretPrice: bigint
    secretAmount: bigint
    nonce: bigint
  }
  expiry?: number
}

/**
 * Order structure that matches 1inch OrderStruct
 */
export interface OrderStruct {
  salt: bigint
  maker: `0x${string}`
  receiver: `0x${string}`
  makerAsset: `0x${string}`
  takerAsset: `0x${string}`
  makingAmount: bigint
  takingAmount: bigint
  makerTraits: bigint
}

/**
 * Complete order with extension and metadata
 */
export interface CommitmentOrder {
  order: OrderStruct & { extension: string }
  commitment: string
  secretParams: {
    secretPrice: bigint
    secretAmount: bigint
    nonce: bigint
  }
}

/**
 * Build maker traits according to 1inch protocol
 */
export function buildMakerTraits(options: {
  allowMultipleFills?: boolean
  shouldCheckEpoch?: boolean
  expiry?: number
  nonce?: number
  series?: number
}): bigint {
  const {
    allowMultipleFills = false,
    shouldCheckEpoch = false,
    expiry = 0,
    nonce = 0,
    series = 0
  } = options

  // Build traits according to 1inch protocol
  let traits = BigInt(0)
  
  if (allowMultipleFills) traits |= BigInt(1)
  if (shouldCheckEpoch) traits |= BigInt(2)
  
  // Add expiry, nonce, and series to traits
  traits |= BigInt(expiry) << BigInt(160)
  traits |= BigInt(nonce) << BigInt(96)
  traits |= BigInt(series) << BigInt(224)
  
  return traits
}

/**
 * Create a commitment order for the frontend
 */
export function buildCommitmentOrder(params: CommitmentOrderParams): CommitmentOrder {
  // Calculate Poseidon commitment from secret parameters
  const commitment = calculateCommitment(
    params.secretParams.secretPrice,
    params.secretParams.secretAmount,
    params.secretParams.nonce
  )

  // Build simple maker traits (no flags, no expiry for simplicity)
  const makerTraits = buildMakerTraits({
    allowMultipleFills: false,
    shouldCheckEpoch: false,
    expiry: params.expiry || 0,
    nonce: 0,
    series: 0
  })

  // Build salt according to 1inch protocol:
  // Upper 96 bits: commitment hash
  // Lower 160 bits: base salt (for orders without extensions)
  const commitmentTruncated = BigInt(commitment) & ((BigInt(1) << BigInt(96)) - BigInt(1))
  const commitmentShifted = commitmentTruncated << BigInt(160)
  const baseSalt = BigInt(keccak256(stringToBytes("ZK_HIDDEN_PARAMS_ORDER"))) & ((BigInt(1) << BigInt(160)) - BigInt(1))
  const properSalt = commitmentShifted | baseSalt

  // Build the order structure
  const order: OrderStruct & { extension: string } = {
    salt: properSalt,
    maker: params.maker,
    receiver: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Zero address for maker
    makerAsset: params.makerAsset,
    takerAsset: params.takerAsset,
    makingAmount: params.makingAmount,
    takingAmount: params.takingAmount,
    makerTraits: makerTraits,
    extension: "0x" // No extensions - clean order
  }

  return {
    order,
    commitment: commitment.toString(),
    secretParams: params.secretParams
  }
}

/**
 * Validate commitment order parameters
 */
export function validateCommitmentOrder(params: CommitmentOrderParams): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Basic validation
  if (!isAddress(params.maker)) {
    errors.push("Invalid maker address")
  }
  if (!isAddress(params.makerAsset)) {
    errors.push("Invalid maker asset address")
  }
  if (!isAddress(params.takerAsset)) {
    errors.push("Invalid taker asset address")
  }
  if (params.makingAmount <= BigInt(0)) {
    errors.push("Making amount must be positive")
  }
  if (params.takingAmount <= BigInt(0)) {
    errors.push("Taking amount must be positive")
  }
  if (params.secretParams.secretPrice <= BigInt(0)) {
    errors.push("Secret price must be positive")
  }
  if (params.secretParams.secretAmount <= BigInt(0)) {
    errors.push("Secret amount must be positive")
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Helper to get commitment from order salt
 */
export function getCommitmentFromOrder(order: OrderStruct): bigint {
  return order.salt
}

/**
 * Helper to format order for display
 */
export function formatOrderForDisplay(order: CommitmentOrder) {
  return {
    maker: order.order.maker,
    makerAsset: order.order.makerAsset,
    takerAsset: order.order.takerAsset,
    makingAmount: order.order.makingAmount.toString(),
    takingAmount: order.order.takingAmount.toString(),
    commitment: order.commitment,
    salt: order.order.salt.toString()
  }
} 