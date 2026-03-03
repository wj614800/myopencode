import { spawn, type ChildProcess } from 'node:child_process';

export interface MCPClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private tools: MCPTool[] = [];
  private name: string;

  constructor(name: string, config: MCPClientConfig) {
    this.name = name;
    this.startProcess(config);
  }

  private startProcess(config: MCPClientConfig): void {
    this.process = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });

    this.process.stdout?.on('data', (data) => {
      console.log(`[MCP ${this.name}]`, data.toString());
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[MCP ${this.name}]`, data.toString());
    });

    this.process.on('error', (error) => {
      console.error(`[MCP ${this.name}] Process error:`, error.message);
    });

    this.process.on('exit', (code) => {
      console.log(`[MCP ${this.name}] Process exited with code ${code}`);
    });
  }

  async initialize(): Promise<void> {
    console.log(`[MCP ${this.name}] Initializing...`);
    
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'myopencode',
          version: '0.1.0',
        },
      },
    };
    
    this.sendMessage(initMessage);
  }

  private sendMessage(message: unknown): void {
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  async listTools(): Promise<MCPTool[]> {
    return this.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };
    
    this.sendMessage(request);
    
    return {
      content: [{ type: 'text', text: `Tool ${name} called with: ${JSON.stringify(args)}` }],
    };
  }

  close(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();

  async addClient(name: string, config: MCPClientConfig): Promise<void> {
    const client = new MCPClient(name, config);
    await client.initialize();
    this.clients.set(name, client);
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  removeClient(name: string): void {
    const client = this.clients.get(name);
    if (client) {
      client.close();
      this.clients.delete(name);
    }
  }

  async getAllTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];
    for (const client of this.clients.values()) {
      const tools = await client.listTools();
      if (tools) {
        allTools.push(...tools);
      }
    }
    return allTools;
  }

  closeAll(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
  }
}

let mcpClientManagerInstance: MCPClientManager | null = null;

export function getMCPClientManager(): MCPClientManager {
  if (!mcpClientManagerInstance) {
    mcpClientManagerInstance = new MCPClientManager();
  }
  return mcpClientManagerInstance;
}
