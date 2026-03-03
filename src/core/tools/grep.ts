import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export async function grep(
  pattern: string, 
  searchPath?: string, 
  include?: string
): Promise<string> {
  const cwd = searchPath || process.cwd();
  const regex = new RegExp(pattern, 'gi');
  const results: string[] = [];
  
  const files = getFiles(cwd, include);
  
  for (const file of files) {
    try {
      const content = readFileSync(join(cwd, file), 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push(`${file}:${i + 1}: ${lines[i].substring(0, 200)}`);
          regex.lastIndex = 0;
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }
  
  if (results.length === 0) {
    return `No matches found for: ${pattern}`;
  }
  
  return results.slice(0, 100).join('\n') + (results.length > 100 ? `\n... and ${results.length - 100} more matches` : '');
}

function getFiles(dir: string, include?: string): string[] {
  const files: string[] = [];
  
  let extFilter: RegExp | null = null;
  if (include) {
    const ext = include.replace(/^\*\./, '');
    extFilter = new RegExp(`\\.${ext}$`, 'i');
  }
  
  walkDir(dir, '', files, extFilter);
  
  return files;
}

function walkDir(dir: string, relPath: string, files: string[], extFilter: RegExp | null): void {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const currentRelPath = relPath ? `${relPath}/${entry}` : entry;
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isFile()) {
          if (!extFilter || extFilter.test(entry)) {
            files.push(currentRelPath);
          }
        } else if (stat.isDirectory()) {
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            walkDir(fullPath, currentRelPath, files, extFilter);
          }
        }
      } catch {
        // Skip inaccessible
      }
    }
  } catch {
    // Skip inaccessible
  }
}
