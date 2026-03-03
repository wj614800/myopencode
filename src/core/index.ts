export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentOptions {
  model: string;
  tools?: Tool[];
  systemPrompt?: string;
  maxTokens?: number;
}

export interface AgentResult {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export async function runSinglePrompt(
  prompt: string,
  options: AgentOptions
): Promise<AgentResult> {
  console.log(`\n> ${prompt}\n`);
  
  const { createAgent } = await import('./agent.js');
  const agent = createAgent(options);
  
  const result = await agent.run(prompt);
  console.log(result.content);
  
  return result;
}

export { createAgent } from './agent.js';
export { SessionManager } from './memory.js';
