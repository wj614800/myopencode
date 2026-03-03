import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

export interface SkillMetadata {
  name: string;
  description: string;
  homepage?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  commandDispatch?: 'tool';
  commandTool?: string;
  commandArgMode?: 'raw';
  os?: string[];
  requires?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
  };
  primaryEnv?: string;
  always?: boolean;
  emoji?: string;
}

export interface Skill {
  name: string;
  description: string;
  instructions: string;
  metadata: SkillMetadata;
  path: string;
}

const SKILL_DIRS = [
  './skills',
  '~/.myopencode/skills',
];

export class SkillLoader {
  private skillsDir: string[];
  private loadedSkills: Map<string, Skill> = new Map();

  constructor(customDirs?: string[]) {
    this.skillsDir = customDirs || SKILL_DIRS.map(dir => {
      if (dir.startsWith('~/')) {
        return join(homedir(), dir.slice(2));
      }
      return dir;
    });
  }

  async loadSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];

    for (const dir of this.skillsDir) {
      if (existsSync(dir)) {
        const dirSkills = await this.loadFromDirectory(dir);
        skills.push(...dirSkills);
      }
    }

    for (const skill of skills) {
      this.loadedSkills.set(skill.name, skill);
    }

    return Array.from(this.loadedSkills.values());
  }

  private async loadFromDirectory(dir: string): Promise<Skill[]> {
    const skills: Skill[] = [];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const entryPath = join(dir, entry);
        
        try {
          const stat = statSync(entryPath);
          
          if (stat.isDirectory()) {
            const skillFile = join(entryPath, 'SKILL.md');
            if (existsSync(skillFile)) {
              const skill = await this.parseSkillFile(skillFile);
              if (skill) {
                skill.path = entryPath;
                skills.push(skill);
              }
            }
          }
        } catch {
          // Skip inaccessible entries
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return skills;
  }

  private async parseSkillFile(filePath: string): Promise<Skill | null> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return this.parseSkillMarkdown(content);
    } catch (error) {
      console.error(`Failed to parse skill file ${filePath}:`, error);
      return null;
    }
  }

  private parseSkillMarkdown(content: string): Skill | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    let metadata: SkillMetadata = {
      name: 'unknown',
      description: '',
    };
    
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      metadata = this.parseFrontmatter(frontmatter);
    }
    
    const instructions = content
      .replace(/^---[\s\S]*?---\n/, '')
      .trim();

    return {
      name: metadata.name,
      description: metadata.description,
      instructions,
      metadata,
      path: '',
    };
  }

  private parseFrontmatter(frontmatter: string): SkillMetadata {
    const result: SkillMetadata = {
      name: 'unknown',
      description: '',
    };

    const lines = frontmatter.split('\n');
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      switch (key) {
        case 'name':
          result.name = value;
          break;
        case 'description':
          result.description = value;
          break;
        case 'homepage':
          result.homepage = value;
          break;
        case 'user-invocable':
          result.userInvocable = value === 'true';
          break;
        case 'disable-model-invocation':
          result.disableModelInvocation = value === 'true';
          break;
        case 'command-dispatch':
          result.commandDispatch = value as 'tool';
          break;
        case 'command-tool':
          result.commandTool = value;
          break;
        case 'command-arg-mode':
          result.commandArgMode = value as 'raw';
          break;
        case 'emoji':
          result.emoji = value;
          break;
        case 'primaryEnv':
          result.primaryEnv = value;
          break;
      }
    }

    const metadataMatch = frontmatter.match(/metadata:\s*(\{[\s\S]*?\})/);
    if (metadataMatch) {
      try {
        const metadata = JSON.parse(metadataMatch[1]);
        if (metadata.openclaw || metadata.opencode) {
          const opencodeMeta = metadata.openclaw || metadata.opencode;
          result.always = opencodeMeta.always;
          result.os = opencodeMeta.os;
          result.requires = opencodeMeta.requires;
          result.primaryEnv = result.primaryEnv || opencodeMeta.primaryEnv;
          result.emoji = result.emoji || opencodeMeta.emoji;
          result.homepage = result.homepage || opencodeMeta.homepage;
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    return result;
  }

  getSkill(name: string): Skill | undefined {
    return this.loadedSkills.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.loadedSkills.values());
  }

  async checkSkillEligibility(skill: Skill): Promise<boolean> {
    if (skill.metadata.always) {
      return true;
    }

    if (skill.metadata.os && skill.metadata.os.length > 0) {
      const currentOs = process.platform;
      if (!skill.metadata.os.includes(currentOs)) {
        return false;
      }
    }

    if (skill.metadata.requires?.bins) {
      for (const bin of skill.metadata.requires.bins) {
        if (!this.commandExists(bin)) {
          return false;
        }
      }
    }

    if (skill.metadata.requires?.anyBins) {
      const hasAny = skill.metadata.requires.anyBins.some(bin => this.commandExists(bin));
      if (!hasAny) {
        return false;
      }
    }

    if (skill.metadata.requires?.env) {
      for (const envVar of skill.metadata.requires.env) {
        if (!process.env[envVar]) {
          return false;
        }
      }
    }

    return true;
  }

  private commandExists(command: string): boolean {
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

let skillLoaderInstance: SkillLoader | null = null;

export function getSkillLoader(customDirs?: string[]): SkillLoader {
  if (!skillLoaderInstance) {
    skillLoaderInstance = new SkillLoader(customDirs);
  }
  return skillLoaderInstance;
}
