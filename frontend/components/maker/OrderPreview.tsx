'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { CreateOrderFormData } from '@/components/forms/CreateOrderSchema'

interface OrderPreviewProps {
  formData: Partial<CreateOrderFormData>
  isValid: boolean
  commitmentHash?: string
}

export function OrderPreview({ formData, isValid, commitmentHash }: OrderPreviewProps) {
  const expirationDate = useMemo(() => {
    if (!formData.expiration) return null
    return new Date(formData.expiration * 1000)
  }, [formData.expiration])

  const exchangeRate = useMemo(() => {
    if (!formData.makingAmount || !formData.takingAmount) return null
    
    const making = parseFloat(formData.makingAmount)
    const taking = parseFloat(formData.takingAmount)
    
    if (making <= 0 || taking <= 0) return null
    
    return taking / making
  }, [formData.makingAmount, formData.takingAmount])

  if (!isValid || !formData.makerAsset || !formData.takerAsset) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <div className="text-lg mb-2">📋</div>
          <p>Complete the form to preview your order</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Order Preview</h3>
        <Badge variant="default" className="bg-green-100 text-green-800">
          Ready to Create
        </Badge>
      </div>

      {/* Token Pair */}
      <div className="border rounded-lg p-4 bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <div className="font-semibold text-lg text-foreground">
              {formData.makingAmount} {formData.makerAsset.symbol}
            </div>
            <div className="text-sm text-muted-foreground">You're selling</div>
          </div>
          
          <div className="mx-4 text-muted-foreground">→</div>
          
          <div className="text-center">
            <div className="font-semibold text-lg text-foreground">
              {formData.takingAmount} {formData.takerAsset.symbol}
            </div>
            <div className="text-sm text-muted-foreground">You want</div>
          </div>
        </div>
        
        {exchangeRate && (
          <div className="mt-3 pt-3 border-t text-center text-sm text-muted-foreground">
            Rate: 1 {formData.makerAsset.symbol} = {exchangeRate.toFixed(6)} {formData.takerAsset.symbol}
          </div>
        )}
      </div>

      {/* Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-medium text-muted-foreground">Exchange Rate</div>
          <div className="text-foreground">
            {exchangeRate ? 
              `${exchangeRate.toFixed(6)} ${formData.takerAsset?.symbol}` : 
              'Not set'
            }
          </div>
        </div>
        
        <div>
          <div className="font-medium text-muted-foreground">Partial Fills</div>
          <div className="text-foreground">{formData.allowPartialFill ? 'Allowed' : 'Not allowed'}</div>
        </div>
        
        <div>
          <div className="font-medium text-muted-foreground">Expires</div>
          <div className="text-foreground">
            {formData.doesNotExpire 
              ? 'Never expires' 
              : (expirationDate?.toLocaleString() || 'Not set')
            }
          </div>
        </div>
        
        <div>
          <div className="font-medium text-muted-foreground">Privacy Nonce</div>
          <div className="font-mono text-xs text-foreground">{formData.secrets?.nonce || 'Not set'}</div>
        </div>
      </div>

      {/* Hidden Constraints */}
      <div className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r">
        <h4 className="font-medium text-blue-900 mb-2">🔒 Hidden Constraints</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-blue-700">Min Price:</span>{' '}
            <span className="font-mono text-blue-900">
              {formData.secrets?.secretPrice ? 
                `${formData.secrets.secretPrice} ${formData.takerAsset?.symbol}` : 
                'Not set'
              }
            </span>
          </div>
          <div>
            <span className="text-blue-700">Min Amount:</span>{' '}
            <span className="font-mono text-blue-900">
              {formData.secrets?.secretAmount ? 
                `${formData.secrets.secretAmount} ${formData.makerAsset?.symbol}` : 
                'Not set'
              }
            </span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          These values are only visible to you and will be cryptographically hidden from takers
        </p>
      </div>

      {/* Commitment Hash */}
      {commitmentHash && (
        <div className="border rounded-lg p-3 bg-muted/50">
          <div className="font-medium text-muted-foreground mb-1">Commitment Hash</div>
          <div className="font-mono text-xs break-all text-muted-foreground">
            {commitmentHash}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            This hash cryptographically commits to your hidden constraints
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-green-50 border border-green-200 rounded-md p-3">
        <div className="flex items-start">
          <span className="text-green-600 mr-2">🛡️</span>
          <div className="text-sm text-green-700">
            <strong>Zero-Knowledge Privacy:</strong> Your secret constraints are hidden using 
            cryptographic commitments. Takers can only learn if their offers meet your requirements.
          </div>
        </div>
      </div>
    </Card>
  )
} 