import { createInterface } from 'node:readline';
import { getSessionManager } from '../core/memory.js';
import { createAgent } from '../core/agent.js';
import chalk from 'chalk';

interface ChatOptions {
  model?: string;
}

export async function startChat(options: ChatOptions): Promise<void> {
  const sessionManager = getSessionManager();
  let session = sessionManager.getCurrentSession();
  
  if (!session) {
    session = sessionManager.createSession(undefined, options.model);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const model = options.model || 'openai/gpt-4o';
  
  console.log(chalk.cyan('\n=== myopencode Chat ==='));
  console.log(chalk.gray(`Model: ${model}`));
  console.log(chalk.gray('Type /help for commands, /exit to quit\n'));

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    const input = await question(chalk.green('> '));
    
    if (!input.trim()) continue;
    
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      
      switch (cmd) {
        case 'exit':
        case 'quit':
          console.log(chalk.yellow('Goodbye!'));
          rl.close();
          return;
        
        case 'help':
          console.log(`
Commands:
  /model <name>   Switch model (e.g., deepseek/deepseek-chat)
  /clear          Clear conversation history
  /sessions       List previous sessions
  /load <id>      Load a previous session
  /new            Start a new session
  /exit           Exit chat
`);
          continue;
        
        case 'model':
          if (args[0]) {
            console.log(chalk.cyan(`Model switched to: ${args[0]}`));
          } else {
            console.log(chalk.gray(`Current model: ${model}`));
          }
          continue;
        
        case 'clear':
          sessionManager.clearMessages();
          console.log(chalk.yellow('Conversation cleared.'));
          continue;
        
        case 'sessions':
          const sessions = sessionManager.listSessions();
          console.log(chalk.cyan('\nPrevious sessions:'));
          for (const s of sessions.slice(0, 10)) {
            console.log(`  ${chalk.gray(s.id.substring(0, 8))} - ${s.name} (${s.messages.length} messages)`);
          }
          continue;
        
        case 'load':
          if (args[0]) {
            const loaded = sessionManager.loadSession(args[0]);
            if (loaded) {
              console.log(chalk.green(`Loaded session: ${loaded.name}`));
            } else {
              console.log(chalk.red('Session not found'));
            }
          }
          continue;
        
        case 'new':
          sessionManager.createSession(undefined, model);
          console.log(chalk.yellow('New session started.'));
          continue;
        
        default:
          console.log(chalk.red(`Unknown command: /${cmd}`));
          continue;
      }
    }

    try {
      const agent = createAgent({ model });
      const result = await agent.run(input);
      console.log(chalk.white(result.content));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    }
  }
}
