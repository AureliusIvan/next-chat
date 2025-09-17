'use client'

import { useState, useEffect } from 'react'
import { ConversationSidebar } from '@/components/ConversationSidebar'
import ChatInterface from './ChatInterface'
import { useActiveConversation } from '@/hooks/useConversations'

const DEFAULT_USER_ID = 'default-user'

export default function ChatLayout() {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined)
  const [userId] = useState(DEFAULT_USER_ID)

  // Get the active conversation
  const { data: activeConversation } = useActiveConversation(userId)

  // Set active conversation when data loads
  useEffect(() => {
    if (activeConversation && !activeConversationId) {
      setActiveConversationId(activeConversation.id)
    }
  }, [activeConversation, activeConversationId])

  const handleConversationSelect = (conversationId: string) => {
    setActiveConversationId(conversationId)
  }

  const handleNewConversation = () => {
    // Reset to undefined to show the empty state
    setActiveConversationId(undefined)
  }

  const handleConversationCreated = (conversationId: string) => {
    // Update the active conversation when a new one is created
    setActiveConversationId(conversationId)
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        userId={userId}
        activeConversationId={activeConversationId}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          conversationId={activeConversationId}
          userId={userId}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  )
}
