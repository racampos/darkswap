import { ethers } from "hardhat";
import { calculateCommitment } from "./commitmentUtils";

/**
 * Simple commitment order interface for REST-based ZK architecture
 */
export interface CommitmentOrderParams {
  maker: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  secretParams: {
    secretPrice: bigint;
    secretAmount: bigint;
    nonce: bigint;
  };
  expiry?: number;
}

/**
 * Order structure that matches 1inch OrderStruct
 */
export interface OrderStruct {
  salt: bigint;
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: bigint;
  takingAmount: bigint;
  makerTraits: bigint;
}

/**
 * Simple commitment order result
 */
export interface CommitmentOrderResult {
  order: OrderStruct & { extension: string };
  commitment: string;
  secretParams: {
    secretPrice: bigint;
    secretAmount: bigint;
    nonce: bigint;
  };
}

/**
 * Creates a simple 1inch order with a commitment to secret parameters.
 * No extensions, no complex salt packing - just a standard order with commitment as salt.
 * The maker will later use a REST service to authorize fills with ZK proofs.
 */
export async function buildCommitmentOrder(params: CommitmentOrderParams): Promise<CommitmentOrderResult> {
  // Calculate Poseidon commitment from secret parameters
  const commitment = calculateCommitment(
    params.secretParams.secretPrice,
    params.secretParams.secretAmount,
    params.secretParams.nonce
  );

  // Import 1inch utilities
  const { buildOrder, buildMakerTraits } = await import("../../test/helpers/orderUtils");

  // Build simple maker traits (no flags, no expiry for simplicity)
  const makerTraits = buildMakerTraits({
    allowMultipleFills: false,
    shouldCheckEpoch: false,
    expiry: params.expiry || 0,
    nonce: 0,
    series: 0
  });

  // Build standard 1inch order with commitment as salt
  const baseOrder = buildOrder({
    salt: commitment,
    maker: params.maker,
    receiver: "0x0000000000000000000000000000000000000000", // Zero address for maker
    makerAsset: params.makerAsset,
    takerAsset: params.takerAsset,
    makingAmount: params.makingAmount,
    takingAmount: params.takingAmount,
    makerTraits: makerTraits
  });

  // Add extension property to the order
  const order = {
    ...baseOrder,
    extension: "0x" // No extensions - clean order
  };

  return {
    order,
    commitment: commitment.toString(),
    secretParams: params.secretParams
  };
}

/**
 * Signs a commitment order using EIP-712
 */
export async function signCommitmentOrder(
  order: OrderStruct,
  chainId: bigint,
  routerAddress: string,
  signer: any
): Promise<string> {
  const { signOrder } = await import("../../test/helpers/orderUtils");
  return signOrder(order, chainId, routerAddress, signer);
}

/**
 * Validates commitment order parameters
 */
export function validateCommitmentOrder(params: CommitmentOrderParams): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic validation
  if (!ethers.isAddress(params.maker)) {
    errors.push("Invalid maker address");
  }
  if (!ethers.isAddress(params.makerAsset)) {
    errors.push("Invalid maker asset address");
  }
  if (!ethers.isAddress(params.takerAsset)) {
    errors.push("Invalid taker asset address");
  }
  if (params.makingAmount <= 0n) {
    errors.push("Making amount must be positive");
  }
  if (params.takingAmount <= 0n) {
    errors.push("Taking amount must be positive");
  }
  if (params.secretParams.secretPrice <= 0n) {
    errors.push("Secret price must be positive");
  }
  if (params.secretParams.secretAmount <= 0n) {
    errors.push("Secret amount must be positive");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Helper to get commitment from order salt
 */
export function getCommitmentFromOrder(order: OrderStruct): bigint {
  return order.salt;
} 