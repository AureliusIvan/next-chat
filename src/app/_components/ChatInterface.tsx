"use client";

import { useState, useEffect, useRef } from "react";
import { useAgentChat } from "../_hooks/useAgent";
import { useMessages } from "@/hooks/useMessages";
import ChatBubble from "./ChatBubble";
import { AiInput } from "@/components/ui/ai-input";
import { Loader2, AlertCircle, MessageSquare } from "lucide-react";

interface ChatInterfaceProps {
    conversationId?: string;
    userId?: string;
    onConversationCreated?: (conversationId: string) => void;
}

export default function ChatInterface({ conversationId, userId = "default-user", onConversationCreated }: ChatInterfaceProps) {
    const [message, setMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Use the enhanced agent chat hook with conversation context
    const { chat, loading, error, clearError, effectiveConversationId } = useAgentChat({
        conversationId,
        userId,
        onConversationCreated,
    });

    // Get messages for the current conversation (use effectiveConversationId if available)
    const { data: messages, isLoading: messagesLoading, error: messagesError } = useMessages(effectiveConversationId || conversationId || "");

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = async (value: string) => {
        if (!value.trim()) return;

        try {
            await chat(value);
            setMessage("");
        } catch (err) {
            // Error is already handled by the hook
            console.error("Chat submission failed:", err);
        }
    };

    const handleClearError = () => {
        clearError();
    };

    const filteredMessages = messages?.filter((msg: any) => msg.status !== 'sending' || msg.role === 'assistant') || [];

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            {/* Chat Messages Container */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
            >
                {messagesLoading && filteredMessages.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                        <span className="ml-2 text-gray-500">Loading conversation...</span>
                    </div>
                )}

                {messagesError && (
                    <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Failed to load messages: {messagesError.message}
                    </div>
                )}

                {!conversationId && filteredMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Start a new conversation</h3>
                        <p className="text-gray-500 max-w-sm">
                            Send a message to begin chatting with the AI assistant. Your conversation will be saved automatically.
                        </p>
                    </div>
                )}

                {conversationId && filteredMessages.length === 0 && !messagesLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                        <p className="text-gray-500 max-w-sm">
                            This conversation is empty. Send your first message to get started.
                        </p>
                    </div>
                )}

                {/* Messages List */}
                {filteredMessages.map((msg: any) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] ${
                                msg.role === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : msg.status === 'failed'
                                        ? 'bg-red-100 border border-red-300'
                                        : 'bg-gray-100'
                            } rounded-lg p-3`}
                        >
                            {msg.status === 'sending' && msg.role === 'assistant' && (
                                <div className="flex items-center space-x-2 mb-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-sm text-gray-500">AI is thinking...</span>
                                </div>
                            )}

                            <ChatBubble
                                message={{
                                    role: msg.role,
                                    content: msg.content,
                                    analytics: msg.analytics,
                                }}
                            />

                            {msg.status === 'failed' && (
                                <div className="mt-2 text-xs text-red-600 flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Failed to send
                                </div>
                            )}

                            {msg.createdAt && (
                                <div className="mt-2 text-xs text-gray-500">
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-3 mx-4 mb-2 bg-red-100 border border-red-400 text-red-700 rounded flex items-center justify-between">
                    <div className="flex items-center">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span>Error: {error}</span>
                    </div>
                    <button
                        onClick={handleClearError}
                        className="text-red-700 hover:text-red-900 text-sm underline"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Input Form */}
            <div className="p-4 border-t bg-white">
                <AiInput
                    value={message}
                    setValue={setMessage}
                    onChange={setMessage}
                    disabled={loading}
                    onSubmit={handleSubmit}
                />
                {loading && (
                    <div className="flex items-center justify-center mt-2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-500 mr-2" />
                        <span className="text-sm text-gray-500">Sending message...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
