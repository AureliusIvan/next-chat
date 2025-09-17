// Simple localStorage-based database operations
import { type Conversation, type Message, type NewConversation, type NewMessage } from './database'

// Storage keys
const CONVERSATIONS_KEY = 'chatbot-conversations'
const MESSAGES_KEY = 'chatbot-messages'

// Utility functions
export const generateId = () => crypto.randomUUID()

export const createTimestamp = () => new Date()

// localStorage operations for conversations
export const conversationStorage = {
  getAll: (userId?: string): Conversation[] => {
    try {
      const data = localStorage.getItem(CONVERSATIONS_KEY)
      const conversations = data ? JSON.parse(data) : []

      if (userId) {
        return conversations.filter((c: Conversation) => c.userId === userId)
      }

      return conversations
    } catch (error) {
      console.error('Failed to load conversations:', error)
      return []
    }
  },

  getById: (id: string): Conversation | null => {
    try {
      const conversations = conversationStorage.getAll()
      return conversations.find(c => c.id === id) || null
    } catch (error) {
      console.error('Failed to get conversation:', error)
      return null
    }
  },

  save: (conversations: Conversation[]) => {
    try {
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
    } catch (error) {
      console.error('Failed to save conversations:', error)
    }
  },

  add: (conversation: Conversation) => {
    const conversations = conversationStorage.getAll()
    conversations.push(conversation)
    conversationStorage.save(conversations)
  },

  update: (id: string, updates: Partial<Conversation>) => {
    const conversations = conversationStorage.getAll()
    const index = conversations.findIndex(c => c.id === id)

    if (index !== -1) {
      conversations[index] = { ...conversations[index], ...updates }
      conversationStorage.save(conversations)
      return conversations[index]
    }

    return null
  },

  delete: (id: string) => {
    const conversations = conversationStorage.getAll()
    const filtered = conversations.filter(c => c.id !== id)
    conversationStorage.save(filtered)

    // Also delete associated messages
    messageStorage.deleteByConversationId(id)

    return conversations.find(c => c.id === id) || null
  },
}

// localStorage operations for messages
export const messageStorage = {
  getAll: (conversationId?: string): Message[] => {
    try {
      const data = localStorage.getItem(MESSAGES_KEY)
      const messages = data ? JSON.parse(data) : []

      if (conversationId) {
        return messages.filter((m: Message) => m.conversationId === conversationId)
      }

      return messages
    } catch (error) {
      console.error('Failed to load messages:', error)
      return []
    }
  },

  getById: (id: string): Message | null => {
    try {
      const messages = messageStorage.getAll()
      return messages.find(m => m.id === id) || null
    } catch (error) {
      console.error('Failed to get message:', error)
      return null
    }
  },

  save: (messages: Message[]) => {
    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages))
    } catch (error) {
      console.error('Failed to save messages:', error)
    }
  },

  add: (message: Message) => {
    const messages = messageStorage.getAll()
    messages.push(message)
    messageStorage.save(messages)
  },

  update: (id: string, updates: Partial<Message>) => {
    const messages = messageStorage.getAll()
    const index = messages.findIndex(m => m.id === id)

    if (index !== -1) {
      messages[index] = { ...messages[index], ...updates }
      messageStorage.save(messages)
      return messages[index]
    }

    return null
  },

  delete: (id: string) => {
    const messages = messageStorage.getAll()
    const filtered = messages.filter(m => m.id !== id)
    messageStorage.save(filtered)
    return messages.find(m => m.id === id) || null
  },

  deleteByConversationId: (conversationId: string) => {
    const messages = messageStorage.getAll()
    const filtered = messages.filter(m => m.conversationId !== conversationId)
    messageStorage.save(filtered)
  },
}

// Sync configuration (for future backend integration)
export const syncConfig = {
  syncUrl: process.env.NEXT_PUBLIC_SYNC_URL || '/api/sync',
  syncInterval: 5000,
  retryInterval: 1000,
  conflictResolution: 'last-write-wins' as const,
  offlineQueue: {
    maxRetries: 3,
    retryDelay: 1000,
  },
}

// React Query configuration
export const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
}

// Export types
export type { Conversation, Message, NewConversation, NewMessage }
