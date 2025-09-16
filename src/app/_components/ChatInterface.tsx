"use client";

import { useState } from "react";
import { useAgentChat } from "../_hooks/useAgent";
import ChatBubble from "./ChatBubble";

export default function ChatInterface() {
    const [message, setMessage] = useState("");
    const { chat, loading, error, response } = useAgentChat();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        await chat(message);
        setMessage("");
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <form onSubmit={handleSubmit} className="mb-4">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Send a message..."
                    className="w-full p-2 border rounded"
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                >
                    {loading ? "Thinking..." : "Send"}
                </button>
            </form>

            {error && (
                <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    Error: {error}
                </div>
            )}

            {response && (
                <div className="p-3 bg-gray-100 border rounded">
                    <ChatBubble message={response.message} />
                </div>
            )}
        </div>
    );
}
