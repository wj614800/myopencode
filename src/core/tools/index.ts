export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.register({
      name: 'read',
      description: 'Read a file from the filesystem',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the file to read' },
          limit: { type: 'number', description: 'Maximum number of lines to read' },
          offset: { type: 'number', description: 'Line number to start reading from' },
        },
        required: ['filePath'],
      },
      execute: async (input) => {
        const { readFileSync, existsSync } = await import('node:fs');
        const { filePath } = input as { filePath: string; limit?: number; offset?: number };
        
        if (!existsSync(filePath)) {
          return `Error: File not found: ${filePath}`;
        }
        
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const offset = (input.offset as number) || 1;
        const limit = input.limit as number || lines.length;
        
        const selectedLines = lines.slice(offset - 1, offset - 1 + limit);
        return selectedLines.join('\n') + (limit < lines.length ? `\n... (${lines.length} total lines)` : '');
      },
    });

    this.register({
      name: 'write',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the file to write' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['filePath', 'content'],
      },
      execute: async (input) => {
        const { writeFileSync, mkdirSync, existsSync } = await import('node:fs');
        const { filePath, content } = input as { filePath: string; content: string };
        
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dir && !existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        
        writeFileSync(filePath, content, 'utf-8');
        return `File written: ${filePath}`;
      },
    });

    this.register({
      name: 'edit',
      description: 'Edit a specific part of a file',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the file to edit' },
          oldString: { type: 'string', description: 'The text to replace' },
          newString: { type: 'string', description: 'The new text' },
        },
        required: ['filePath', 'oldString', 'newString'],
      },
      execute: async (input) => {
        const { readFileSync, writeFileSync, existsSync } = await import('node:fs');
        const { filePath, oldString, newString } = input as { 
          filePath: string; 
          oldString: string; 
          newString: string;
        };
        
        if (!existsSync(filePath)) {
          return `Error: File not found: ${filePath}`;
        }
        
        const content = readFileSync(filePath, 'utf-8');
        
        if (!content.includes(oldString)) {
          return `Error: Could not find the specified text in the file`;
        }
        
        const newContent = content.replace(oldString, newString);
        writeFileSync(filePath, newContent, 'utf-8');
        return `File edited: ${filePath}`;
      },
    });

    this.register({
      name: 'bash',
      description: 'Execute a shell command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          description: { type: 'string', description: 'Description of what the command does' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['command'],
      },
      execute: async (input) => {
        const { exec } = await import('node:child_process');
        const { command, timeout } = input as { 
          command: string; 
          description?: string;
          timeout?: number;
        };
        
        return new Promise((resolve) => {
          const timeoutMs = timeout || 60000;
          const timer = setTimeout(() => {
            resolve(`Error: Command timed out after ${timeoutMs}ms`);
          }, timeoutMs);
          
          exec(command, { cwd: process.cwd(), timeout: timeoutMs }, (error, stdout, stderr) => {
            clearTimeout(timer);
            if (error) {
              resolve(`Error: ${error.message}\n${stderr}`);
            } else {
              resolve(stdout || 'Command executed successfully');
            }
          });
        });
      },
    });

    this.register({
      name: 'glob',
      description: 'Find files matching a glob pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to match files' },
          path: { type: 'string', description: 'Directory to search in' },
        },
        required: ['pattern'],
      },
      execute: async (input) => {
        const { glob } = await import('./glob.js');
        const { pattern, path } = input as { pattern: string; path?: string };
        return await glob(pattern, path);
      },
    });

    this.register({
      name: 'grep',
      description: 'Search for text in files',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression pattern to search' },
          path: { type: 'string', description: 'Directory or file to search in' },
          include: { type: 'string', description: 'File pattern to include (e.g., *.ts)' },
        },
        required: ['pattern'],
      },
      execute: async (input) => {
        const { grep } = await import('./grep.js');
        const { pattern, path, include } = input as { 
          pattern: string; 
          path?: string;
          include?: string;
        };
        return await grep(pattern, path, include);
      },
    });

    this.register({
      name: 'websearch',
      description: 'Search the web for information',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
      execute: async (input) => {
        const { webSearch } = await import('./websearch.js');
        const { query } = input as { query: string };
        return await webSearch(query);
      },
    });
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.execute(args);
  }
}

let toolRegistryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistryInstance) {
    toolRegistryInstance = new ToolRegistry();
  }
  return toolRegistryInstance;
}

export { ToolRegistry as _ToolRegistry };
