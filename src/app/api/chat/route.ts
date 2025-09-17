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
    const startTime = Date.now();
    const result = await agent.run(message);
    const responseTime = Date.now() - startTime;

    // Add mock analytics data for testing
    const enhancedResponse = {
      ...result.data,
      message: {
        ...result.data.message,
        analytics: {
          tokenUsage: {
            promptTokens: Math.floor(Math.random() * 1000) + 500,
            completionTokens: Math.floor(Math.random() * 500) + 200,
            totalTokens: Math.floor(Math.random() * 1500) + 700,
          },
          responseTime,
          toolsUsed: result.data.message.role === 'assistant' ? ['greet'] : [],
          model: 'gpt-4o-mini',
          timestamp: new Date().toISOString(),
          cost: parseFloat((Math.random() * 0.01).toFixed(6)), // Mock cost in USD
        },
      },
    };

    return NextResponse.json({ response: enhancedResponse });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
