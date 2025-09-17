"use client";

import { useState } from "react";
import { useAgentChat } from "../_hooks/useAgent";
import ChatBubble from "./ChatBubble";
import { AiInput } from "@/components/ui/ai-input";

export default function ChatInterface() {
    const [message, setMessage] = useState("");
    const { chat, loading, error, response } = useAgentChat();

    const handleSubmit = async (value: string) => {
        if (!value.trim()) return;

        await chat(value);
        setMessage("");
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
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

            <form className="mb-4">
                {/* <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Send a message..."
                    className="w-full p-2 border rounded"
                    disabled={loading}
                /> */}
                <AiInput
                    value={message}
                    setValue={setMessage}
                    onChange={setMessage}
                    disabled={loading}
                    onSubmit={handleSubmit}
                />
            </form>
        </div>
    );
}
