'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { type AuthorizeFillResponse } from '@/lib/api/types'

interface AuthorizationStatusProps {
  isAuthorizing: boolean
  isAuthorized: boolean
  authorization: AuthorizeFillResponse | null
  error: string | null
  authorizationTime: number | null
  onRequestAuthorization: () => void
  onClearAuthorization: () => void
  isAuthorizationValid: () => boolean
  className?: string
}

export function AuthorizationStatus({
  isAuthorizing,
  isAuthorized,
  authorization,
  error,
  authorizationTime,
  onRequestAuthorization,
  onClearAuthorization,
  isAuthorizationValid,
  className = ''
}: AuthorizationStatusProps) {
  const getStatusBadge = () => {
    if (error) {
      return (
        <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
          ❌ Authorization Failed
        </Badge>
      )
    }
    
    if (isAuthorizing) {
      return (
        <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          🔄 Requesting Authorization
        </Badge>
      )
    }
    
    if (isAuthorized && isAuthorizationValid()) {
      return (
        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
          ✅ Authorized
        </Badge>
      )
    }
    
    if (isAuthorized && !isAuthorizationValid()) {
      return (
        <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          ⏰ Authorization Expired
        </Badge>
      )
    }
    
    return (
      <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        ⚪ Not Authorized
      </Badge>
    )
  }

  const getTimeRemaining = () => {
    if (!authorizationTime || !isAuthorized) return null
    
    const expirationTime = 10 * 60 * 1000 // 10 minutes
    const elapsed = Date.now() - authorizationTime
    const remaining = expirationTime - elapsed
    
    if (remaining <= 0) return 'Expired'
    
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">ZK Authorization</h3>
          {getStatusBadge()}
        </div>

        {/* Description */}
        <div className="text-sm text-muted-foreground">
          <p>
            Privacy-preserving authorization uses Zero-Knowledge proofs to verify 
            the order can be filled without revealing maker's secret parameters.
          </p>
        </div>

        {/* Authorization Details */}
        {isAuthorized && authorization && (
          <div className="space-y-3">
            <div className="p-3 bg-background/50 rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Order ID:</span>
                  <p className="font-mono text-foreground">
                    {authorization.orderWithExtension.salt?.slice(0, 8)}...
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Signature:</span>
                  <p className="font-mono text-foreground">
                    {authorization.signature.slice(0, 8)}...
                  </p>
                </div>
              </div>
              
              {authorizationTime && isAuthorizationValid() && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Time Remaining:</span>
                    <span className="font-medium text-green-400">
                      {getTimeRemaining()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">
              <span className="font-medium">Error:</span> {error}
            </p>
          </div>
        )}

        {/* Loading State */}
        {isAuthorizing && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></div>
              </div>
              <span className="text-sm text-blue-400">
                Generating ZK proof for order authorization...
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-3">
          {!isAuthorized && !isAuthorizing && (
            <Button
              onClick={onRequestAuthorization}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Request Authorization
            </Button>
          )}
          
          {isAuthorized && !isAuthorizationValid() && (
            <Button
              onClick={onRequestAuthorization}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              Renew Authorization
            </Button>
          )}
          
          {(isAuthorized || error) && (
            <Button
              variant="ghost"
              onClick={onClearAuthorization}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-background/30 p-3 rounded-lg">
          <p className="flex items-center space-x-1">
            <span>🔒</span>
            <span>
              ZK authorization ensures order fills comply with maker's private constraints 
              while maintaining complete privacy of sensitive parameters.
            </span>
          </p>
        </div>
      </div>
    </Card>
  )
} 