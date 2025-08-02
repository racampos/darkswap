'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi'
import { buildTakerTraits } from '../utils/takerTraits'
import { type Hash, hexToSignature } from 'viem'
import { ethers } from 'ethers'
import AggregationRouterV6ABI from '../abi/AggregationRouterV6.json'
import { getRouterAddress } from '../constants/contracts'
import type { AuthorizeFillResponse } from '../api/types'

export type TransactionStep = 
  | 'preparing'
  | 'waiting_approval'
  | 'confirming'
  | 'confirmed'
  | 'failed'

interface TransactionState {
  step: TransactionStep
  hash?: string
  error?: string
  isLoading: boolean
}

function extractExtension(order: any): string {
  return order.extension || '0x'
}

export function useTransaction() {
  const { address } = useAccount()
  const [transactionState, setTransactionState] = useState<TransactionState>({
    step: 'preparing',
    isLoading: false
  })

  // Contract write configuration
  const { 
    data: writeData,
    write: executeContractWrite,
    error: writeError,
    isLoading: isWriteLoading
  } = useContractWrite({
    address: getRouterAddress('localhost') as `0x${string}`,
    abi: AggregationRouterV6ABI,
    functionName: 'fillOrderArgs',
  })

  // Wait for transaction confirmation
  const { 
    data: receipt,
    error: receiptError,
    isLoading: isReceiptLoading
  } = useWaitForTransaction({
    hash: writeData?.hash,
  })

  const updateStep = useCallback((step: TransactionStep, additionalData?: Partial<TransactionState>) => {
    setTransactionState(prev => ({
      ...prev,
      step,
      isLoading: step === 'waiting_approval' || step === 'confirming',
      ...additionalData
    }))
  }, [])

  const executeTransaction = useCallback(async (authorization: AuthorizeFillResponse, fillAmount: string) => {
    if (!address) {
      updateStep('failed', { error: 'Wallet not connected' })
      return
    }

    console.log('🔄 Preparing REAL blockchain transaction:', {
      orderData: authorization.orderWithExtension,
      signature: authorization.signature,
      fillAmount: fillAmount
    })

    console.log('🔍 FULL AUTHORIZATION RESPONSE:', {
      success: authorization.success,
      hasOrderData: !!authorization.orderWithExtension,
      hasSignature: !!authorization.signature,
      signatureLength: authorization.signature?.length,
      orderKeys: authorization.orderWithExtension ? Object.keys(authorization.orderWithExtension) : [],
      rawOrderWithExtension: JSON.stringify(authorization.orderWithExtension, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2)
    })

    // Parse signature using ethers.js (like the working demo script)
    const ethersSignature = ethers.Signature.from(authorization.signature)
    const r = ethersSignature.r
    const vs = ethersSignature.yParityAndS

    console.log('🔍 SIGNATURE DEBUG (using ethers.js like demo):', {
      originalSig: authorization.signature,
      parsedR: r,
      parsedVs: vs,
      originalLength: authorization.signature.length
    })

    // Extract extension and build taker traits
    const extension = extractExtension(authorization.orderWithExtension)
    const takerTraitsData = buildTakerTraits({
      makingAmount: false, // Following PredicateExtensions.test.ts pattern
      extension: extension,
      target: address,
      interaction: '0x'
    })

    console.log('🔍 ORIGINAL ORDER FROM BACKEND:', {
      salt: authorization.orderWithExtension.salt,
      maker: authorization.orderWithExtension.maker,
      receiver: authorization.orderWithExtension.receiver,
      makerAsset: authorization.orderWithExtension.makerAsset,
      takerAsset: authorization.orderWithExtension.takerAsset,
      makingAmount: authorization.orderWithExtension.makingAmount,
      takingAmount: authorization.orderWithExtension.takingAmount,
      makerTraits: authorization.orderWithExtension.makerTraits,
      hasExtension: !!(authorization.orderWithExtension as any).extension,
      extensionLength: (authorization.orderWithExtension as any).extension?.length || 0
    })

    // Convert numerical fields to BigInt for the 1inch contract (but keep extension field!)
    const orderForContract = {
      salt: BigInt(authorization.orderWithExtension.salt),
      maker: authorization.orderWithExtension.maker,
      receiver: authorization.orderWithExtension.receiver,
      makerAsset: authorization.orderWithExtension.makerAsset,
      takerAsset: authorization.orderWithExtension.takerAsset,
      makingAmount: BigInt(authorization.orderWithExtension.makingAmount),
      takingAmount: BigInt(authorization.orderWithExtension.takingAmount),
      makerTraits: BigInt(authorization.orderWithExtension.makerTraits),
      // CRITICAL: Include extension field like the working demo script!
      extension: (authorization.orderWithExtension as any).extension || '0x'
    }

    console.log('🔍 ORDER FOR CONTRACT (including extension):', {
      salt: orderForContract.salt.toString(),
      maker: orderForContract.maker,
      receiver: orderForContract.receiver,
      makerAsset: orderForContract.makerAsset,
      takerAsset: orderForContract.takerAsset,
      makingAmount: orderForContract.makingAmount.toString(),
      takingAmount: orderForContract.takingAmount.toString(),
      makerTraits: orderForContract.makerTraits.toString(),
      extension: orderForContract.extension,
      extensionLength: orderForContract.extension.length
    })

    console.log('📝 Real transaction parameters:', {
      orderMaker: orderForContract.maker,
      fillAmount: fillAmount,
      extensionLength: extension.length,
      takerTraits: takerTraitsData.traits,
      r: r.slice(0, 10) + '...',
      vs: vs.slice(0, 10) + '...'
    })

    console.log('🔍 DEBUG - Order types:', {
      salt: typeof orderForContract.salt,
      maker: typeof orderForContract.maker,
      makingAmount: typeof orderForContract.makingAmount,
      takingAmount: typeof orderForContract.takingAmount,
      makerTraits: typeof orderForContract.makerTraits,
      extension: typeof orderForContract.extension
    })

    console.log('🚀 Calling 1inch AggregationRouterV6.fillOrderArgs...')

    // ===== CRITICAL DEBUGGING: LOG EXACT fillOrderArgs PARAMETERS =====
    console.log('🔍 FRONTEND - fillOrderArgs PARAMETERS:')
    console.log(`   OrderWithExtension: ${JSON.stringify(orderForContract, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 2)}`)
    console.log(`   Signature R: ${r}`)
    console.log(`   Signature VS: ${vs}`)
    console.log(`   Fill Amount: ${fillAmount} (wei)`)
    console.log(`   Taker Traits: ${takerTraitsData.traits || '0x0'}`)
    console.log(`   Taker Args: ${takerTraitsData.args}`)
    console.log(`   Extension: ${extension.slice(0, 100)}${extension.length > 100 ? '...' : ''} (${extension.length} chars)`)

    console.log('🔍 DEBUG - Transaction args:', {
      orderWithExtension: JSON.stringify(orderForContract, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2),
      r,
      vs,
      fillAmount: fillAmount,
      fillAmountType: typeof BigInt(fillAmount),
      takerTraits: takerTraitsData.traits || '0x0',
      takerTraitsType: typeof BigInt(takerTraitsData.traits || '0x0'),
      args: takerTraitsData.args
    })

    console.log('📝 About to call executeContractWrite...')

    try {
      const txResult = await executeContractWrite({
        args: [
          orderForContract,     // Order struct WITH extension (like demo script)
          r,                    // signature r
          vs,                   // signature vs (using ethers.js yParityAndS)
          BigInt(fillAmount),   // fill amount
          BigInt(takerTraitsData.traits || '0x0'), // taker traits
          takerTraitsData.args  // extension args
        ]
      })

      updateStep('waiting_approval')
      console.log('✅ Transaction submitted successfully:', txResult)
    } catch (error: any) {
      console.error('❌ Transaction failed:', error)
      updateStep('failed', { 
        error: error?.message || 'Transaction failed' 
      })
    }
  }, [address, executeContractWrite, updateStep])

  // Handle transaction receipt
  useEffect(() => {
    if (receipt) {
      updateStep('confirmed', { 
        hash: receipt.transactionHash 
      })
      console.log('✅ Transaction confirmed:', receipt)
    }
  }, [receipt, updateStep])

  // Handle receipt error
  useEffect(() => {
    if (receiptError) {
      updateStep('failed', { 
        error: receiptError.message 
      })
      console.error('❌ Transaction receipt error:', receiptError)
    }
  }, [receiptError, updateStep])

  // Handle write error
  useEffect(() => {
    if (writeError) {
      updateStep('failed', { 
        error: writeError.message 
      })
      console.error('❌ Transaction write error:', writeError)
    }
  }, [writeError, updateStep])

  const resetTransaction = useCallback(() => {
    setTransactionState({
      step: 'preparing',
      isLoading: false
    })
  }, [])

  const getCurrentStep = useCallback(() => transactionState.step, [transactionState.step])
  
  const getProgress = useCallback(() => {
    switch (transactionState.step) {
      case 'preparing': return 0
      case 'waiting_approval': return 25
      case 'confirming': return 50
      case 'confirmed': return 100
      case 'failed': return 0
      default: return 0
    }
  }, [transactionState.step])

  const isLoading = useMemo(() => 
    isWriteLoading || isReceiptLoading || transactionState.isLoading
  , [isWriteLoading, isReceiptLoading, transactionState.isLoading])

  return {
    executeTransaction,
    resetTransaction,
    getCurrentStep,
    getProgress,
    transactionState,
    isLoading
  }
} 