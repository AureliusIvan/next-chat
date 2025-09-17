import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { conversationStorage, messageStorage, generateId, createTimestamp } from '@/lib/db-config'
import type { Conversation, NewConversation, Message } from '@/lib/db-config'

// Query keys for React Query
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (userId: string) => [...conversationKeys.lists(), userId] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  active: (userId: string) => [...conversationKeys.all, 'active', userId] as const,
}

// Hook to get all conversations for a user
export function useConversations(userId: string) {
  return useQuery({
    queryKey: conversationKeys.list(userId),
    queryFn: async () => {
      const result = conversationStorage.getAll(userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

      return result
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook to get a specific conversation
export function useConversation(id: string) {
  return useQuery({
    queryKey: conversationKeys.detail(id),
    queryFn: async () => {
      const result = conversationStorage.getById(id)
      return result
    },
    enabled: !!id,
  })
}

// Hook to get active conversation for a user
export function useActiveConversation(userId: string) {
  return useQuery({
    queryKey: conversationKeys.active(userId),
    queryFn: async () => {
      const conversations = conversationStorage.getAll(userId)
      const activeConversation = conversations.find(c => c.isActive === true)
      return activeConversation || null
    },
    enabled: !!userId,
  })
}

// Hook to create a new conversation
export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<NewConversation, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = createTimestamp()
      const newConversation: Conversation = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        isActive: data.isActive ?? true,
      }

      conversationStorage.add(newConversation)
      return newConversation
    },
    onSuccess: (newConversation, variables) => {
      // Invalidate and refetch conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.list(variables.userId)
      })

      // Add new conversation to cache
      queryClient.setQueryData(
        conversationKeys.detail(newConversation.id),
        newConversation
      )
    },
    onError: (error) => {
      console.error('Failed to create conversation:', error)
    },
  })
}

// Hook to update a conversation
export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string
      updates: Partial<Pick<Conversation, 'title' | 'isActive' | 'metadata'>>
    }) => {
      const updateData = {
        ...updates,
        updatedAt: createTimestamp(),
      }

      const result = conversationStorage.update(id, updateData)
      return result
    },
    onSuccess: (updatedConversation) => {
      if (!updatedConversation) return

      // Update conversation in cache
      queryClient.setQueryData(
        conversationKeys.detail(updatedConversation.id),
        updatedConversation
      )

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })
    },
    onError: (error) => {
      console.error('Failed to update conversation:', error)
    },
  })
}

// Hook to delete a conversation
export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete conversation (messages are deleted automatically in the storage layer)
      const result = conversationStorage.delete(id)
      return result
    },
    onSuccess: (deletedConversation) => {
      if (!deletedConversation) return

      // Remove conversation from cache
      queryClient.removeQueries({
        queryKey: conversationKeys.detail(deletedConversation.id)
      })

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })
    },
    onError: (error) => {
      console.error('Failed to delete conversation:', error)
    },
  })
}

// Hook to set active conversation
export function useSetActiveConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      conversationId
    }: {
      userId: string
      conversationId: string | null
    }) => {
      // First, set all conversations for this user to inactive
      const allConversations = conversationStorage.getAll(userId)

      for (const conversation of allConversations) {
        conversationStorage.update(conversation.id, {
          isActive: false,
          updatedAt: createTimestamp(),
        })
      }

      // If there's a conversation to activate, set it as active
      if (conversationId) {
        const result = conversationStorage.update(conversationId, {
          isActive: true,
          updatedAt: createTimestamp(),
        })
        return result
      }

      return null
    },
    onSuccess: (activeConversation, variables) => {
      // Update active conversation cache
      queryClient.setQueryData(
        conversationKeys.active(variables.userId),
        activeConversation
      )

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })
    },
    onError: (error) => {
      console.error('Failed to set active conversation:', error)
    },
  })
}

// Hook to get conversation with messages (combined query)
export function useConversationWithMessages(conversationId: string) {
  return useQuery({
    queryKey: [...conversationKeys.detail(conversationId), 'with-messages'],
    queryFn: async () => {
      const conversationResult = conversationStorage.getById(conversationId)
      const messagesResult = messageStorage.getAll(conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      return {
        conversation: conversationResult,
        messages: messagesResult,
      }
    },
    enabled: !!conversationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Hook to get recent conversations with message counts
export function useRecentConversations(userId: string, limit: number = 10) {
  return useQuery({
    queryKey: [...conversationKeys.list(userId), 'recent', limit],
    queryFn: async () => {
      // Get conversations
      const conversationsResult = conversationStorage.getAll(userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, limit)

      // Get message counts and last messages for each conversation
      const conversationsWithCounts = conversationsResult.map((conversation) => {
        const conversationMessages = messageStorage.getAll(conversation.id)

        const messageCount = conversationMessages.length

        const lastMessage = conversationMessages
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null

        return {
          ...conversation,
          messageCount,
          lastMessage,
        }
      })

      return conversationsWithCounts
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}
