"use client";

import { ChatMessage } from "../types";

export default function ChatBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="p-3 bg-gray-100 border rounded">
      <strong>{message.role}</strong>
      <p>{message.content}</p>
    </div>
  );
}
