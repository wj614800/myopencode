import { getConfigManager } from '../../config/index.js';
import chalk from 'chalk';

export async function handleConfigCommand(args: string[]): Promise<void> {
  const config = getConfigManager();
  const subcommand = args[0];

  if (!subcommand || subcommand === 'list') {
    const allConfig = config.getAll();
    console.log(chalk.cyan('Current configuration:'));
    console.log(JSON.stringify(allConfig, null, 2));
    return;
  }

  switch (subcommand) {
    case 'set': {
      const [key, value] = args.slice(1);
      if (!key || !value) {
        console.log(chalk.red('Usage: config set <key> <value>'));
        return;
      }
      config.set(key as any, value);
      console.log(chalk.green(`Set ${key} = ${value}`));
      break;
    }

    case 'get': {
      const key = args[1];
      if (!key) {
        console.log(chalk.red('Usage: config get <key>'));
        return;
      }
      const value = config.get(key as any);
      console.log(value);
      break;
    }

    case 'provider': {
      const providerCmd = args[1];
      
      if (providerCmd === 'list') {
        const providers = config.get('providers');
        console.log(chalk.cyan('Configured providers:'));
        console.log(JSON.stringify(providers, null, 2));
      } else if (providerCmd === 'add') {
        const [name, apiKey, baseUrl] = args.slice(2);
        if (!name || !apiKey) {
          console.log(chalk.red('Usage: config provider add <name> <apiKey> [baseUrl]'));
          return;
        }
        
        const providers = config.get('providers') || {};
        (providers as any)[name] = {
          apiKey,
          baseUrl: baseUrl || undefined,
        };
        config.set('providers', providers as any);
        console.log(chalk.green(`Added provider: ${name}`));
      } else {
        console.log(chalk.gray('Usage: config provider [list|add]'));
      }
      break;
    }

    case 'model': {
      const model = args[1];
      if (!model) {
        console.log(chalk.gray(`Current default model: ${config.getDefaultModel() || 'not set'}`));
        return;
      }
      config.setDefaultModel(model);
      console.log(chalk.green(`Default model set to: ${model}`));
      break;
    }

    default:
      console.log(chalk.red(`Unknown config command: ${subcommand}`));
      console.log(chalk.gray('Usage: config [list|set|get|provider|model]'));
  }
}
