import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { openai } from "@llamaindex/openai";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

// Initialize agent once (consider using a singleton pattern)
let myAgent: any = null;

async function initializeAgent() {
  if (myAgent) return myAgent;

  try {
    const greetTool = tool({
      name: "greet",
      description: "Greets a user with their name",
      parameters: z.object({
        name: z.string(),
      }),
      execute: ({ name }) => `Hello, ${name}! How can I help you today?`,
    });

    myAgent = agent({
      tools: [greetTool],
      llm: openai({ model: "gpt-4o-mini" }),
    });

    return myAgent;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    const agent = await initializeAgent();
    const result = await agent.run(message);

    return NextResponse.json({ response: result.data });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
