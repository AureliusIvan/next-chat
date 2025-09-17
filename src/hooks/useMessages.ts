import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messageStorage, generateId, createTimestamp } from '@/lib/db-config'
import { conversationKeys } from './useConversations'
import type { Message, NewMessage } from '@/lib/db-config'

// Query keys for React Query
export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  list: (conversationId: string) => [...messageKeys.lists(), conversationId] as const,
  details: () => [...messageKeys.all, 'detail'] as const,
  detail: (id: string) => [...messageKeys.details(), id] as const,
  analytics: (conversationId: string) => [...messageKeys.list(conversationId), 'analytics'] as const,
}

// Hook to get messages for a conversation
export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: messageKeys.list(conversationId),
    queryFn: async () => {
      const result = messageStorage.getAll(conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      return result
    },
    enabled: !!conversationId,
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Hook to get a specific message
export function useMessage(id: string) {
  return useQuery({
    queryKey: messageKeys.detail(id),
    queryFn: async () => {
      const result = messageStorage.getById(id)
      return result
    },
    enabled: !!id,
  })
}

// Hook to get messages with analytics for a conversation
export function useMessagesWithAnalytics(conversationId: string) {
  return useQuery({
    queryKey: messageKeys.analytics(conversationId),
    queryFn: async () => {
      const messages = messageStorage.getAll(conversationId)
      const result = messages
        .filter(msg => msg.analytics)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      return result
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook to create a new message with optimistic updates
export function useCreateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Omit<NewMessage, 'id' | 'createdAt'>) => {
      const newMessage: Message = {
        ...data,
        id: generateId(),
        createdAt: createTimestamp(),
        status: data.status ?? 'sent',
      }

      messageStorage.add(newMessage)
      return newMessage
    },
    onMutate: async (newMessageData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: messageKeys.list(newMessageData.conversationId)
      })

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<Message[]>(
        messageKeys.list(newMessageData.conversationId)
      )

      // Optimistically update to the new value
      const optimisticMessage: Message = {
        ...newMessageData,
        id: `temp-${Date.now()}`, // Temporary ID
        createdAt: createTimestamp(),
        status: 'sending',
      } as Message

      queryClient.setQueryData<Message[]>(
        messageKeys.list(newMessageData.conversationId),
        (old) => old ? [...old, optimisticMessage] : [optimisticMessage]
      )

      // Update conversation's updatedAt timestamp
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      // Return a context object with the snapshotted value
      return { previousMessages, optimisticMessage }
    },
    onError: (err, newMessageData, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMessages) {
        queryClient.setQueryData(
          messageKeys.list(newMessageData.conversationId),
          context.previousMessages
        )
      }
    },
    onSuccess: (createdMessage, variables, context) => {
      // Replace optimistic message with real message
      queryClient.setQueryData<Message[]>(
        messageKeys.list(variables.conversationId),
        (old) => {
          if (!old) return [createdMessage]

          return old.map(msg =>
            msg.id === context?.optimisticMessage.id
              ? { ...createdMessage, status: 'sent' as const }
              : msg
          )
        }
      )

      // Update conversation's updatedAt timestamp
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(variables.conversationId)
      })
    },
  })
}

// Hook to update a message
export function useUpdateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string
      updates: Partial<Pick<Message, 'content' | 'status' | 'analytics' | 'metadata'>>
    }) => {
      const result = messageStorage.update(id, updates)
      return result
    },
    onSuccess: (updatedMessage) => {
      if (!updatedMessage) return

      // Update message in all relevant caches
      queryClient.setQueryData<Message[]>(
        messageKeys.list(updatedMessage.conversationId),
        (old) => {
          if (!old) return []

          return old.map(msg =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          )
        }
      )

      // Update individual message cache
      queryClient.setQueryData(
        messageKeys.detail(updatedMessage.id),
        updatedMessage
      )

      // Update conversation's updatedAt if message status changed
      if (updatedMessage.status === 'sent' || updatedMessage.status === 'failed') {
        queryClient.invalidateQueries({
          queryKey: conversationKeys.lists()
        })
      }
    },
    onError: (error) => {
      console.error('Failed to update message:', error)
    },
  })
}

// Hook to delete a message
export function useDeleteMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const result = messageStorage.delete(id)
      return result
    },
    onSuccess: (deletedMessage) => {
      if (!deletedMessage) return

      // Remove message from conversation cache
      queryClient.setQueryData<Message[]>(
        messageKeys.list(deletedMessage.conversationId),
        (old) => {
          if (!old) return []

          return old.filter(msg => msg.id !== deletedMessage.id)
        }
      )

      // Remove individual message cache
      queryClient.removeQueries({
        queryKey: messageKeys.detail(deletedMessage.id)
      })

      // Update conversation's updatedAt
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })
    },
    onError: (error) => {
      console.error('Failed to delete message:', error)
    },
  })
}

// Hook to mark messages as failed
export function useMarkMessageFailed() {
  const updateMessage = useUpdateMessage()

  return useMutation({
    mutationFn: async (id: string) => {
      return updateMessage.mutateAsync({
        id,
        updates: { status: 'failed' }
      })
    },
  })
}

// Hook to retry failed message
export function useRetryMessage() {
  const updateMessage = useUpdateMessage()

  return useMutation({
    mutationFn: async (id: string) => {
      return updateMessage.mutateAsync({
        id,
        updates: { status: 'sending' }
      })
    },
  })
}

// Hook to get conversation message count
export function useMessageCount(conversationId: string) {
  return useQuery({
    queryKey: [...messageKeys.list(conversationId), 'count'],
    queryFn: async () => {
      const messages = messageStorage.getAll(conversationId)
      return messages.length
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Hook to get last message in conversation
export function useLastMessage(conversationId: string) {
  return useQuery({
    queryKey: [...messageKeys.list(conversationId), 'last'],
    queryFn: async () => {
      const messages = messageStorage.getAll(conversationId)
      const sortedMessages = messages.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      return sortedMessages[0] || null
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Hook to search messages in a conversation
export function useSearchMessages(conversationId: string, searchTerm: string) {
  return useQuery({
    queryKey: [...messageKeys.list(conversationId), 'search', searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) {
        return []
      }

      const messages = messageStorage.getAll(conversationId)
      const result = messages
        .filter(msg => msg.content.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return result
    },
    enabled: !!conversationId && !!searchTerm.trim(),
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}
