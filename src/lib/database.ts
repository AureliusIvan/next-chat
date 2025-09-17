// Type definitions for conversations and messages
export interface Conversation {
  id: string
  title: string
  userId: string
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  metadata?: Record<string, unknown>
}

export interface NewConversation {
  title: string
  userId: string
  isActive?: boolean
  metadata?: Record<string, unknown>
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
  status: 'sending' | 'sent' | 'failed'
  analytics?: MessageAnalytics
  metadata?: Record<string, unknown>
}

export interface NewMessage {
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status?: 'sending' | 'sent' | 'failed'
  analytics?: MessageAnalytics
  metadata?: Record<string, unknown>
}

// Analytics type (matching existing types)
export interface MessageAnalytics {
  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  responseTime?: number
  toolsUsed?: string[]
  model?: string
  timestamp?: string
  cost?: number
  requestId?: string
}

// Utility functions
export const generateId = () => crypto.randomUUID()

export const createTimestamp = () => new Date()
