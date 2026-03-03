import { getSessionManager } from '../../core/memory.js';
import chalk from 'chalk';

export async function handleSessionCommand(args: string[]): Promise<void> {
  const sessionManager = getSessionManager();
  const subcommand = args[0];

  if (!subcommand || subcommand === 'list') {
    const sessions = sessionManager.listSessions();
    
    console.log(chalk.cyan('\nSessions:'));
    if (sessions.length === 0) {
      console.log(chalk.gray('No sessions found.'));
      return;
    }
    
    for (const session of sessions.slice(0, 20)) {
      const date = new Date(session.updatedAt).toLocaleString();
      console.log(`  ${chalk.green(session.id.substring(0, 8))}`);
      console.log(`    Name: ${session.name}`);
      console.log(`    Messages: ${session.messages.length}`);
      console.log(`    Updated: ${date}`);
      console.log();
    }
    return;
  }

  switch (subcommand) {
    case 'show': {
      const sessionId = args[1];
      if (!sessionId) {
        console.log(chalk.red('Usage: session show <id>'));
        return;
      }
      
      const session = sessionManager.loadSession(sessionId);
      if (!session) {
        console.log(chalk.red('Session not found'));
        return;
      }
      
      console.log(chalk.cyan(`Session: ${session.name}`));
      console.log(`ID: ${session.id}`);
      console.log(`Created: ${new Date(session.createdAt).toLocaleString()}`);
      console.log(`Messages: ${session.messages.length}\n`);
      
      for (const msg of session.messages) {
        console.log(chalk.gray(`[${msg.role}]`), msg.content.substring(0, 100));
      }
      break;
    }

    case 'delete': {
      const sessionId = args[1];
      if (!sessionId) {
        console.log(chalk.red('Usage: session delete <id>'));
        return;
      }
      
      const deleted = sessionManager.deleteSession(sessionId);
      if (deleted) {
        console.log(chalk.green('Session deleted'));
      } else {
        console.log(chalk.red('Session not found'));
      }
      break;
    }

    case 'current': {
      const session = sessionManager.getCurrentSession();
      if (session) {
        console.log(chalk.cyan('Current session:'));
        console.log(`  ID: ${session.id}`);
        console.log(`  Name: ${session.name}`);
        console.log(`  Messages: ${session.messages.length}`);
      } else {
        console.log(chalk.gray('No active session'));
      }
      break;
    }

    case 'new': {
      const session = sessionManager.createSession();
      console.log(chalk.green('New session created:'));
      console.log(`  ID: ${session.id}`);
      console.log(`  Name: ${session.name}`);
      break;
    }

    default:
      console.log(chalk.red(`Unknown session command: ${subcommand}`));
      console.log(chalk.gray('Usage: session [list|show|delete|current|new]'));
  }
}
