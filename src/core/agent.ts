import type { Tool, AgentOptions, AgentResult } from './index.js';
import type { Message } from './memory.js';
import { getSessionManager } from './memory.js';
import { getProvider, parseModelId } from '../models/provider.js';
import { getToolRegistry } from './tools/index.js';

const DEFAULT_SYSTEM_PROMPT = `You are an AI coding assistant called myopencode. You help users with software development tasks including:
- Writing, reading, and editing code
- Running shell commands
- Searching through files
- Explaining code and concepts

Be concise and helpful. When you need to perform actions, use the available tools.`;

export interface Agent {
  run(prompt: string): Promise<AgentResult>;
}

export function createAgent(options: AgentOptions): Agent {
  const sessionManager = getSessionManager();
  const toolRegistry = getToolRegistry();
  
  let session = sessionManager.getCurrentSession();
  if (!session) {
    session = sessionManager.createSession(undefined, options.model);
  }
  
  const { provider: providerName, model: modelName } = parseModelId(options.model);
  const modelProvider = getProvider(providerName);
  
  return {
    async run(prompt: string): Promise<AgentResult> {
      sessionManager.addMessage('user', prompt);
      
      const tools = toolRegistry.getTools();
      
      const messages: Message[] = [
        { role: 'system', content: options.systemPrompt || DEFAULT_SYSTEM_PROMPT },
        ...sessionManager.getMessages(),
      ];
      
      const response = await modelProvider.chat({
        model: modelName,
        messages,
        tools: tools as any,
      });
      
      sessionManager.addMessage('assistant', response.content, {
        toolCalls: response.toolCalls?.map((tc: any, i: number) => ({
          id: `call_${i}`,
          name: tc.name,
          arguments: tc.arguments,
        })),
      });
      
      const toolResults: string[] = [];
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          try {
            const result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
            const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
            toolResults.push(`Tool ${toolCall.name} result: ${resultStr}`);
            
            sessionManager.addMessage('user', `Tool ${toolCall.name} result: ${resultStr}`, {
              toolCallId: `call_${toolResults.length - 1}`,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            toolResults.push(`Tool ${toolCall.name} error: ${errorMsg}`);
            sessionManager.addMessage('user', `Tool ${toolCall.name} error: ${errorMsg}`, {
              toolCallId: `call_${toolResults.length - 1}`,
            });
          }
        }
        
        const continuedResponse = await modelProvider.chat({
          model: modelName,
          messages: sessionManager.getMessages(),
          tools: tools as any,
        });
        
        return {
          content: continuedResponse.content,
          toolCalls: response.toolCalls,
        };
      }
      
      return {
        content: response.content,
        toolCalls: response.toolCalls,
      };
    },
  };
}

export async function runWithModel(
  prompt: string,
  model: string,
  options?: { systemPrompt?: string; maxTokens?: number }
): Promise<AgentResult> {
  const agent = createAgent({ model, ...options });
  return agent.run(prompt);
}
