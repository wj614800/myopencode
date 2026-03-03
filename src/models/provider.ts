import type { Message } from '../core/memory.js';

export interface ModelCallOptions {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ModelResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  reasoning?: string;
}

export interface ModelProvider {
  chat(options: ModelCallOptions): Promise<ModelResponse>;
}

export function parseModelId(modelId: string): { provider: string; model: string } {
  const parts = modelId.split('/');
  if (parts.length === 1) {
    return { provider: 'openai', model: modelId };
  }
  return { provider: parts[0], model: parts.slice(1).join('/') };
}

export function getProvider(provider: string): ModelProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'deepseek':
      return new DeepSeekProvider();
    case 'google':
      return new GoogleProvider();
    default:
      return new OpenAICompatibleProvider(provider);
  }
}

async function getProviderConfig() {
  const { getConfigManager } = await import('../config/index.js');
  return getConfigManager();
}

class OpenAIProvider implements ModelProvider {
  async chat(options: ModelCallOptions): Promise<ModelResponse> {
    const config = await getProviderConfig();
    const providerConfig = config.getProvider('openai');
    
    const apiKey = providerConfig?.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = providerConfig?.baseUrl || 'https://api.openai.com/v1';
    const { model } = parseModelId(options.model);
    
    const messages = this.convertMessages(options.messages);
    const tools = options.tools ? this.convertTools(options.tools) : undefined;
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json() as any;
    const choice = result.choices[0];
    const message = choice.message;
    
    return {
      content: message.content || '',
      toolCalls: message.tool_calls?.map((tc: any) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    };
  }
  
  private convertMessages(messages: Message[]): any[] {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      name: m.name,
    }));
  }
  
  private convertTools(tools: ToolDefinition[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}

class AnthropicProvider implements ModelProvider {
  async chat(options: ModelCallOptions): Promise<ModelResponse> {
    const config = await getProviderConfig();
    const providerConfig = config.getProvider('anthropic');
    
    const apiKey = providerConfig?.apiKey || process.env.ANTHROPIC_API_KEY;
    const baseUrl = providerConfig?.baseUrl || 'https://api.anthropic.com/v1';
    const { model } = parseModelId(options.model);
    
    const messages = options.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
    
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 4096,
        messages,
        system: options.system,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json() as any;
    const content = result.content?.[0];
    
    if (content?.type === 'tool_use') {
      return {
        content: '',
        toolCalls: [{
          name: content.name,
          arguments: content.input,
        }],
      };
    }
    
    return {
      content: content?.text || '',
    };
  }
}

class DeepSeekProvider implements ModelProvider {
  async chat(options: ModelCallOptions): Promise<ModelResponse> {
    const config = await getProviderConfig();
    const providerConfig = config.getProvider('deepseek');
    
    const apiKey = providerConfig?.apiKey || process.env.DEEPSEEK_API_KEY;
    const baseUrl = providerConfig?.baseUrl || 'https://api.deepseek.com/v1';
    const { model } = parseModelId(options.model);
    
    const messages = options.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json() as any;
    const choice = result.choices[0];
    
    return {
      content: choice.message.content || '',
      reasoning: choice.message.reasoning_content,
    };
  }
}

class GoogleProvider implements ModelProvider {
  async chat(options: ModelCallOptions): Promise<ModelResponse> {
    return { content: 'Google provider not implemented. Use OpenAI compatible mode.' };
  }
}

class OpenAICompatibleProvider implements ModelProvider {
  private providerName: string;
  
  constructor(providerName: string) {
    this.providerName = providerName;
  }
  
  async chat(options: ModelCallOptions): Promise<ModelResponse> {
    const config = await getProviderConfig();
    const providerConfig = config.getProvider(this.providerName);
    
    const apiKey = providerConfig?.apiKey;
    const baseUrl = providerConfig?.baseUrl;
    const { model } = parseModelId(options.model);
    
    if (!baseUrl) {
      throw new Error(`No baseUrl configured for provider: ${this.providerName}`);
    }
    
    const messages = options.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.providerName} API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json() as any;
    const choice = result.choices[0];
    
    return {
      content: choice.message.content || '',
    };
  }
}
