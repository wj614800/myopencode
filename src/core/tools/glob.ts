import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export async function glob(pattern: string, basePath?: string): Promise<string> {
  const cwd = basePath || process.cwd();
  const parts = pattern.split('/');
  const firstPart = parts[0];
  const restParts = parts.slice(1);
  
  let results: string[] = [];
  
  try {
    const files = readdirSync(cwd);
    
    if (firstPart === '*') {
      results = files.filter(f => {
        try {
          return statSync(join(cwd, f)).isFile();
        } catch {
          return false;
        }
      });
    } else if (firstPart === '**') {
      results = walkDir(cwd);
    } else if (firstPart.includes('*')) {
      const regex = new RegExp('^' + firstPart.replace(/\*/g, '.*') + '$');
      results = files.filter(f => regex.test(f));
    } else {
      const match = files.find(f => f === firstPart || f.startsWith(firstPart + '/'));
      if (match) {
        results = [match];
      }
    }
    
    const extPattern = restParts.join('/');
    if (extPattern) {
      const extRegex = new RegExp(extPattern.replace(/\*/g, '.*'));
      results = results.filter(r => extRegex.test(r));
    }
    
    return results.length > 0 ? results.join('\n') : 'No files found';
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function walkDir(dir: string, relativePath: string = ''): string[] {
  const results: string[] = [];
  
  try {
    const files = readdirSync(dir);
    
    for (const file of files) {
      const fullPath = join(dir, file);
      const relPath = relativePath ? `${relativePath}/${file}` : file;
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isFile()) {
          results.push(relPath);
        } else if (stat.isDirectory()) {
          results.push(...walkDir(fullPath, relPath));
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  
  return results;
}
