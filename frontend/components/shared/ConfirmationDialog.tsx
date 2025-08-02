'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
  isLoading?: boolean
  children?: React.ReactNode
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
  children
}: ConfirmationDialogProps) {
  if (!isOpen) return null

  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          icon: '⚠️',
          confirmButtonClass: 'bg-red-600 hover:bg-red-700 text-white',
          borderClass: 'border-red-500/50'
        }
      case 'warning':
        return {
          icon: '⚠️',
          confirmButtonClass: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          borderClass: 'border-yellow-500/50'
        }
      default:
        return {
          icon: '❓',
          confirmButtonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
          borderClass: 'border-blue-500/50'
        }
    }
  }

  const styles = getVariantStyles()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <Card className={`relative w-full max-w-md mx-4 border ${styles.borderClass}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start space-x-3 mb-4">
            <span className="text-2xl">{styles.icon}</span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          </div>

          {/* Additional Content */}
          {children && (
            <div className="mb-6 p-4 bg-background/50 rounded-lg border border-border">
              {children}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              {cancelText}
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isLoading}
              className={styles.confirmButtonClass}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
} 