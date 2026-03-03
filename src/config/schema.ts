export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  options?: {
    timeout?: number;
    [key: string]: unknown;
  };
  models?: Record<string, ModelConfig>;
}

export interface ModelConfig {
  name?: string;
  limit?: {
    context?: number;
    maxTokens?: number;
  };
  options?: Record<string, unknown>;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MemoryConfig {
  maxMessages: number;
  compactAfter: number;
  summarizeModel?: string;
}

export interface SkillConfig {
  enabled: string[];
  dirs: string[];
}

export interface Config {
  providers: Record<string, ProviderConfig>;
  defaultModel?: string;
  smallModel?: string;
  skills?: SkillConfig;
  mcp?: Record<string, MCPServerConfig>;
  memory?: MemoryConfig;
  workspace?: string;
}

export const DEFAULT_CONFIG: Partial<Config> = {
  memory: {
    maxMessages: 100,
    compactAfter: 50,
  },
  skills: {
    enabled: [],
    dirs: ['./skills', '~/.myopencode/skills'],
  },
};
