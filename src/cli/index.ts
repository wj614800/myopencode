#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigManager } from '../config/index.js';

interface Args {
  help: boolean;
  version: boolean;
  model: string | undefined;
  continue: boolean;
  session: string | undefined;
  prompt: string | undefined;
  port: number | undefined;
  hostname: string | undefined;
  command: string | undefined;
}

function printHelp(): void {
  console.log(`
myopencode - A CLI AI coding agent

Usage: myopencode [command] [options]

Commands:
  run <prompt>     Run a single prompt
  chat             Start interactive chat mode
  tui              Start the terminal UI (default)
  config           Manage configuration
  session          Manage sessions

Options:
  -h, --help           Show this help message
  -v, --version        Show version
  -m, --model <model>  Model to use (e.g., deepseek/deepseek-chat)
  -c, --continue       Continue the last session
  -s, --session <id>   Continue a specific session
  -p, --prompt <text>  Prompt to run
  --port <port>        Port for server mode
  --hostname <host>    Hostname for server mode

Examples:
  myopencode "Explain how closures work in JavaScript"
  myopencode chat
  myopencode run --model openai/gpt-4 "Fix this bug"
  myopencode --continue
`.trim());
}

function printVersion(): void {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
  console.log(pkg.version);
}

async function main(): Promise<void> {
  const config = getConfigManager();
  
  const { values, positionals } = parseArgs({
    options: {
      help: { short: 'h', type: 'boolean', default: false },
      version: { short: 'v', type: 'boolean', default: false },
      model: { short: 'm', type: 'string' },
      continue: { short: 'c', type: 'boolean', default: false },
      session: { short: 's', type: 'string' },
      prompt: { short: 'p', type: 'string' },
      port: { type: 'string' },
      hostname: { type: 'string' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  if (values.version) {
    printVersion();
    process.exit(0);
  }

  const args = values as unknown as Args;
  const command = positionals[0] || args.command;
  const prompt = args.prompt || positionals.slice(1).join(' ');

  const model = args.model || config.getDefaultModel() || 'openai/gpt-4o';

  const knownCommands = ['run', 'chat', 'tui', 'config', 'session', 'help'];
  const isModelCommand = command === 'run' || command === 'chat' || command === 'tui' || (!command) || (command && !knownCommands.includes(command) && !!prompt);
  
  if (isModelCommand) {
    console.log(`Using model: ${model}`);
  }

  if (command === 'run') {
    const runPrompt = prompt || positionals.slice(1).join(' ');
    if (!runPrompt) {
      console.error('Error: Please provide a prompt');
      printHelp();
      process.exit(1);
    }
    
    const { runSinglePrompt } = await import('../core/index.js');
    await runSinglePrompt(runPrompt, { model });
  } else if (!command || command === 'tui') {
    const { startChat } = await import('./chat.js');
    await startChat({ model });
  } else if (command === 'chat') {
    const { startChat } = await import('./chat.js');
    await startChat({ model });
  } else if (command === 'config') {
    const { handleConfigCommand } = await import('./commands/config.js');
    await handleConfigCommand(positionals.slice(1));
  } else if (command === 'session') {
    const { handleSessionCommand } = await import('./commands/session.js');
    await handleSessionCommand(positionals.slice(1));
  } else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
