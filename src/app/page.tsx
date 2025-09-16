import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { openai } from "@llamaindex/openai";
import { z } from "zod";
import ChatInterface from "./_components/ChatInterface";

async function initializeAgent() {
  const helpTool = tool({
    name: "getHelp",
    description: "Provides help information",
    parameters: z.object({
      topic: z.string().optional(),
    }),
    execute: ({ topic }) => {
      if (topic) {
        return `Here's help for ${topic}: This is a helpful resource about ${topic}.`;
      }
      return "Available topics: general, troubleshooting, api, deployment";
    },
  });

  return agent({
    tools: [helpTool],
    llm: openai({ model: "gpt-4o-mini" }),
  });
}

export default async function ChatPage() {
  await initializeAgent();

  return (
    <div>
      <h1>Chat Interface</h1>
      <p>Agent initialized and ready to help!</p>
      {/* Your chat UI components */}
      <ChatInterface />
    </div>
  );
}
