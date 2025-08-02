import { z } from 'zod'

// Token validation
export const TokenSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  symbol: z.string().min(1, 'Token symbol is required'),
  decimals: z.number().min(0).max(18),
})

// Amount validation (handles string input for precise decimals)
export const AmountSchema = z.string()
  .min(1, 'Amount is required')
  .refine((val) => {
    const num = parseFloat(val)
    return !isNaN(num) && num > 0
  }, 'Amount must be a positive number')
  .refine((val) => {
    const parts = val.split('.')
    return parts.length <= 2 && (parts[1]?.length || 0) <= 18
  }, 'Too many decimal places (max 18)')

// Secret constraints validation
export const SecretsSchema = z.object({
  secretPrice: z.string()
    .min(1, 'Secret minimum price is required')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    }, 'Secret price must be a positive number'),
  
  secretAmount: z.string()
    .min(1, 'Secret minimum amount is required')
    .refine((val) => {
      const num = parseFloat(val)
      return !isNaN(num) && num > 0
    }, 'Secret amount must be a positive number'),
  
  nonce: z.number().int().min(0, 'Nonce must be a non-negative integer').optional(),
})

// Main order creation form schema
export const CreateOrderSchema = z.object({
  // Token pair
  makerAsset: TokenSchema,
  takerAsset: TokenSchema,
  
  // Amounts and pricing
  makingAmount: AmountSchema,
  takingAmount: AmountSchema,
  
  // Hidden constraints
  secrets: SecretsSchema,
  
  // Order metadata
  expiration: z.number()
    .int()
    .min(Math.floor(Date.now() / 1000) + 300, 'Expiration must be at least 5 minutes from now')
    .max(Math.floor(Date.now() / 1000) + 86400 * 30, 'Expiration cannot exceed 30 days')
    .optional(),
  
  allowPartialFill: z.boolean().default(true),
  
  // New field for expiration control
  doesNotExpire: z.boolean().default(true),
  
}).refine((data) => {
  // If order expires, expiration date is required
  if (!data.doesNotExpire && !data.expiration) {
    return false
  }
  return true
}, {
  message: 'Expiration date is required when order expires',
  path: ['expiration'],
}).refine((data) => {
  // Validate that secret price (total amount) does not exceed order total
  const takingAmount = parseFloat(data.takingAmount)
  const secretPrice = parseFloat(data.secrets.secretPrice)
  return secretPrice <= takingAmount
}, {
  message: 'Secret minimum amount cannot exceed the total order value',
  path: ['secrets', 'secretPrice'],
})

export type CreateOrderFormData = z.infer<typeof CreateOrderSchema>

// Default values for form initialization
export const getDefaultFormValues = (): Partial<CreateOrderFormData> => ({
  allowPartialFill: true,
  doesNotExpire: true, // Default to no expiration
})

// Generate a random nonce for secrets
export const generateRandomNonce = (): number => Math.floor(Math.random() * 1000000)

// Common token addresses for mainnet
export const COMMON_TOKENS = {
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    decimals: 18,
  },
  USDC: {
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  },
} as const 