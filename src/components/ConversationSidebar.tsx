'use client'

import { useState } from 'react'
import { useConversations, useRecentConversations } from '@/hooks/useConversations'
import { useCreateConversation, useSetActiveConversation } from '@/hooks/useConversations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Edit3,
  Check,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  userId: string
  activeConversationId?: string
  onConversationSelect: (conversationId: string) => void
  onNewConversation: () => void
}

export function ConversationSidebar({
  userId,
  activeConversationId,
  onConversationSelect,
  onNewConversation
}: ConversationSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // Fetch conversations
  const { data: conversations, isLoading } = useRecentConversations(userId, 50)

  // Mutations
  const createConversation = useCreateConversation()
  const setActiveConversation = useSetActiveConversation()

  // Filter conversations based on search term
  const filteredConversations = conversations?.filter(conversation =>
    conversation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conversation.lastMessage?.content.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  const handleNewConversation = async () => {
    try {
      const newConversation = await createConversation.mutateAsync({
        userId,
        title: `New Chat ${new Date().toLocaleDateString()}`,
        isActive: true,
      })

      // Set as active conversation
      await setActiveConversation.mutateAsync({
        userId,
        conversationId: newConversation.id,
      })

      onNewConversation()
      onConversationSelect(newConversation.id)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }

  const handleConversationSelect = async (conversationId: string) => {
    try {
      await setActiveConversation.mutateAsync({
        userId,
        conversationId,
      })
      onConversationSelect(conversationId)
    } catch (error) {
      console.error('Failed to set active conversation:', error)
    }
  }

  const handleEditTitle = (conversationId: string, currentTitle: string) => {
    setEditingId(conversationId)
    setEditingTitle(currentTitle)
  }

  const handleSaveTitle = () => {
    // TODO: Implement title update
    setEditingId(null)
    setEditingTitle('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const formatLastMessageTime = (timestamp: string | Date) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="flex flex-col h-full w-80 bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
          <Button
            onClick={handleNewConversation}
            size="sm"
            className="h-8 w-8 p-0"
            disabled={createConversation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-sm">
              {searchTerm ? 'No conversations found' : 'No conversations yet'}
            </p>
            {!searchTerm && (
              <Button
                onClick={handleNewConversation}
                variant="outline"
                size="sm"
                className="mt-4"
                disabled={createConversation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group relative p-3 rounded-lg cursor-pointer transition-colors mb-1",
                  activeConversationId === conversation.id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-100"
                )}
                onClick={() => handleConversationSelect(conversation.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    {editingId === conversation.id ? (
                      <div className="flex items-center space-x-2 mb-1">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle()
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          className="h-6 text-sm flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSaveTitle()
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelEdit()
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <h3 className="text-sm font-medium text-gray-900 truncate mb-1">
                        {conversation.title || 'Untitled Conversation'}
                      </h3>
                    )}

                    {/* Last message preview */}
                    {conversation.lastMessage && (
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.lastMessage.content}
                      </p>
                    )}

                    {/* Timestamp and message count */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        {conversation.updatedAt && formatLastMessageTime(conversation.updatedAt)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {conversation.messageCount} messages
                      </span>
                    </div>
                  </div>

                  {/* Actions menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditTitle(conversation.id, conversation.title || '')
                        }}
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          // TODO: Implement delete conversation
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
