// src/app/_hooks/useAgent.tsx
import { useState } from "react";
import { useCreateMessage, useUpdateMessage } from "@/hooks/useMessages";
import { useUpdateConversation, useCreateConversation } from "@/hooks/useConversations";
import { useMessages } from "@/hooks/useMessages";
import { AgentResponse } from "../types";
import { generateId, createTimestamp } from "@/lib/database";

interface UseAgentChatOptions {
  conversationId?: string;
  userId?: string;
  onConversationCreated?: (conversationId: string) => void;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const { conversationId, userId = "default-user", onConversationCreated } = options;

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [tempConversationId, setTempConversationId] = useState<string | null>(null);

  // TanStack DB hooks
  const createMessage = useCreateMessage();
  const updateMessage = useUpdateMessage();
  const updateConversation = useUpdateConversation();
  const createConversation = useCreateConversation();

  // Use temp conversation ID if no real conversation ID is provided
  const effectiveConversationId = conversationId || tempConversationId;

  // Get conversation messages for context
  const { data: messages } = useMessages(effectiveConversationId || "");

  const chat = async (message: string) => {
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    let currentConversationId = effectiveConversationId;

    // If no conversation exists, create a temporary one
    if (!currentConversationId) {
      try {
        const tempConversation = await createConversation.mutateAsync({
          title: `Chat ${new Date().toLocaleString()}`,
          userId,
          isActive: true,
        });
        currentConversationId = tempConversation.id;
        setTempConversationId(currentConversationId);

        // Notify parent component about the new conversation
        if (onConversationCreated) {
          onConversationCreated(currentConversationId);
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        setError('Failed to create conversation');
        setLoading(false);
        return;
      }
    }

    // Create user message in database
    const userMessageId = generateId();
    const userMessage = {
      id: userMessageId,
      conversationId: currentConversationId!,
      role: "user" as const,
      content: message,
      createdAt: createTimestamp(),
      status: "sent" as const,
    };

    // Create assistant message placeholder
    const assistantMessageBase = {
      conversationId: currentConversationId!,
      role: "assistant" as const,
      content: "",
      status: "sending" as const,
    };

    let assistantMessageId: string | null = null;

    try {
      // Add user message to database
      await createMessage.mutateAsync(userMessage);

      // Prepare conversation context for agent
      const conversationContext = messages ? messages
        .filter((msg: any) => msg.status === "sent")
        .map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })) : [];

      // Add current user message to context
      conversationContext.push({
        role: "user" as const,
        content: message,
      });

      // Add assistant message placeholder and capture real ID
      const createdAssistantMessage = await createMessage.mutateAsync(assistantMessageBase as any);
      assistantMessageId = createdAssistantMessage.id;

      // Make API call with conversation context
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversationId: currentConversationId,
          userId,
          conversationContext: conversationContext.slice(0, -1), // Exclude current message as it's in the body
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      const agentResponse = data.response;

      // Update assistant message with actual response
      await updateMessage.mutateAsync({
        id: assistantMessageId!,
        updates: {
          content: agentResponse.data.message.content,
          status: "sent",
          analytics: agentResponse.data.message.analytics,
        },
      });

      return agentResponse;
    } catch (err) {
      // Mark assistant message as failed (if created)
      try {
        if (assistantMessageId) {
          await updateMessage.mutateAsync({
            id: assistantMessageId,
            updates: { status: "failed" },
          });
        }
      } catch {}

      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    chat,
    loading,
    error,
    clearError: () => setError(null),
    effectiveConversationId,
  };
}