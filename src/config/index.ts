import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config, ProviderConfig } from './schema.js';
import { DEFAULT_CONFIG } from './schema.js';

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    const homeDir = homedir();
    this.configPath = join(homeDir, '.myopencode', 'config.json');
    this.config = this.loadFromFile();
  }

  private loadFromFile(): Config {
    const defaults = DEFAULT_CONFIG as Config;
    
    if (existsSync(this.configPath)) {
      try {
        const fileContent = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        return { ...defaults, ...parsed } as Config;
      } catch (error) {
        console.error('Failed to load config file:', error);
      }
    }
    
    return defaults;
  }

  private saveToFile(): void {
    try {
      const dir = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
      if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save config file:', error);
    }
  }

  get<K extends keyof Config>(key: K): Config[K] | undefined {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
    this.saveToFile();
  }

  getAll(): Config {
    return this.config;
  }

  getProvider(providerId: string): ProviderConfig | undefined {
    return this.config.providers?.[providerId];
  }

  getDefaultModel(): string | undefined {
    return this.config.defaultModel;
  }

  setDefaultModel(model: string): void {
    this.config.defaultModel = model;
    this.saveToFile();
  }

  getProviderApiKey(providerId: string): string | undefined {
    const provider = this.getProvider(providerId);
    return provider?.apiKey;
  }

  getProviderBaseUrl(providerId: string): string | undefined {
    const provider = this.getProvider(providerId);
    return provider?.baseUrl;
  }
}

let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}
