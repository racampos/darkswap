import { type Address } from 'viem'

// Core types for DarkSwap orders
export interface OrderData {
  salt: string
  maker: Address
  receiver: Address
  makerAsset: Address
  takerAsset: Address
  makingAmount: string
  takingAmount: string
  makerTraits: string
}

export interface SignedOrder {
  order: OrderData
  signature: string
  extension?: string
}

export interface PublishedOrder {
  id: string
  chainId: number
  order: OrderData
  signature: string
  extension?: string
  metadata: OrderMetadata
  secrets: SecretParameters
  status: OrderStatus
  createdAt: number
  updatedAt: number
}

export interface OrderMetadata {
  makerToken: TokenInfo
  takerToken: TokenInfo
  rate: number
  maker: Address
  network: string
}

export interface SecretParameters {
  secretPrice: number
  secretAmount: number
  nonce: number
}

export interface TokenInfo {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export enum OrderStatus {
  ACTIVE = 'active',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

// API types
export interface AuthorizeFillRequest {
  orderHash: string
  fillAmount: string
  takerAddress: Address
}

export interface AuthorizeFillResponse {
  success: boolean
  orderWithExtension: OrderData
  signature: string
  message?: string
}

export interface APIError {
  error: string
  details?: string
  code?: number
}

// UI State types
export interface AppState {
  isConnected: boolean
  address?: Address
  chainId?: number
  isWrongNetwork: boolean
  theme: 'light' | 'dark'
}

export interface OrderFilters {
  makerToken?: Address
  takerToken?: Address
  maker?: Address
  status?: OrderStatus
  minAmount?: string
  maxAmount?: string
  sortBy?: 'createdAt' | 'rate' | 'amount'
  sortOrder?: 'asc' | 'desc'
}

// Form types
export interface CreateOrderForm {
  makerToken: Address
  takerToken: Address
  makingAmount: string
  takingAmount: string
  secretPrice: string
  secretAmount: string
}

export interface FillOrderForm {
  fillAmount: string
}

// Network configuration
export interface NetworkConfig {
  chainId: number
  name: string
  rpcUrl: string
  blockExplorer: string
  routerAddress: Address
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

// Transaction types
export interface TransactionStatus {
  hash?: string
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: string
  blockNumber?: number
}

// Component prop types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface ModalProps extends BaseComponentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
}

// Navigation types
export interface NavItem {
  title: string
  href: string
  icon?: string
  disabled?: boolean
  external?: boolean
}

export interface SidebarNavItem extends NavItem {
  items?: SidebarNavItem[]
}

// Theme types
export type Theme = 'light' | 'dark' | 'system'

// Wallet types (extending wagmi/viem types)
export interface WalletInfo {
  address: Address
  ensName?: string
  balance?: bigint
  chainId: number
  isConnected: boolean
}

// API client types
export interface APIClientConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
}

// Real-time update types
export interface OrderUpdate {
  orderId: string
  status: OrderStatus
  timestamp: number
  txHash?: string
}

export interface WebSocketMessage {
  type: 'order_update' | 'order_filled' | 'order_cancelled'
  data: OrderUpdate
}

// Error types
export interface DarkSwapError extends Error {
  code: string
  details?: any
}

export interface FormError {
  field: string
  message: string
}

// Utility types
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type NonEmptyArray<T> = [T, ...T[]] 