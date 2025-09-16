// Chat message roles
export type Role = "user" | "assistant";

// Individual chat message
export interface Message {
  id: string;
  createdAt: string;
  role: Role;
  content: string;
}

// Adapters configuration
export interface Adapters {
  vercel: Record<string, unknown>;
  llamaindex: Record<string, unknown>;
}

// Memory state management
export interface Memory {
  messages: Message[];
  tokenLimit: number;
  shortTermTokenLimitRatio: number;
  memoryBlocks: unknown[];
  memoryCursor: number;
  logger: Record<string, unknown>;
  adapters: Adapters;
}

// Agent state
export interface State {
  memory: Memory;
  scratchpad: unknown[];
  currentAgentName: string;
  agents: string[];
  nextAgentName: string | null;
}

// Simplified message object for responses
export interface ChatMessage {
  role: Role;
  content: string;
}

// Main chatbot API response
export interface AgentResponse {
  message: ChatMessage;
  result: string;
  state: State;
}
