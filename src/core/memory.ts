import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
  reasoning?: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  model?: string;
}

const DEFAULT_MAX_MESSAGES = 100;
const DEFAULT_COMPACT_AFTER = 50;

export class SessionManager {
  private sessionsDir: string;
  private currentSession: Session | null = null;
  private maxMessages: number;
  private compactAfter: number;

  constructor(options?: { maxMessages?: number; compactAfter?: number }) {
    const homeDir = homedir();
    this.sessionsDir = join(homeDir, '.myopencode', 'sessions');
    this.maxMessages = options?.maxMessages || DEFAULT_MAX_MESSAGES;
    this.compactAfter = options?.compactAfter || DEFAULT_COMPACT_AFTER;
    
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  createSession(name?: string, model?: string): Session {
    const session: Session = {
      id: randomUUID(),
      name: name || `Session ${new Date().toLocaleString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      model,
    };
    this.currentSession = session;
    return session;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  loadSession(sessionId: string): Session | null {
    const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
    if (existsSync(sessionPath)) {
      try {
        const content = readFileSync(sessionPath, 'utf-8');
        const session = JSON.parse(content);
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        this.currentSession = session;
        return session;
      } catch (error) {
        console.error('Failed to load session:', error);
      }
    }
    return null;
  }

  saveSession(session: Session): void {
    const sessionPath = join(this.sessionsDir, `${session.id}.json`);
    session.updatedAt = new Date();
    writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  }

  addMessage(role: Message['role'], content: string, options?: { name?: string; toolCalls?: Message['toolCalls']; toolCallId?: string }): void {
    if (!this.currentSession) {
      this.createSession();
    }
    
    const message: Message = {
      role,
      content,
      ...options,
    };
    
    this.currentSession!.messages.push(message);
    this.compactIfNeeded();
    this.saveSession(this.currentSession!);
  }

  getMessages(): Message[] {
    return this.currentSession?.messages || [];
  }

  clearMessages(): void {
    if (this.currentSession) {
      this.currentSession.messages = [];
      this.saveSession(this.currentSession);
    }
  }

  listSessions(): Session[] {
    const sessions: Session[] = [];
    
    try {
      const files = readdirSync(this.sessionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = readFileSync(join(this.sessionsDir, file), 'utf-8');
            const session = JSON.parse(content);
            session.createdAt = new Date(session.createdAt);
            session.updatedAt = new Date(session.updatedAt);
            sessions.push(session);
          } catch {
            // Skip invalid session files
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
    
    return sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  deleteSession(sessionId: string): boolean {
    const sessionPath = join(this.sessionsDir, `${sessionId}.json`);
    
    try {
      if (existsSync(sessionPath)) {
        unlinkSync(sessionPath);
        if (this.currentSession?.id === sessionId) {
          this.currentSession = null;
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
    return false;
  }

  private compactIfNeeded(): void {
    if (!this.currentSession) return;
    
    const messageCount = this.currentSession.messages.length;
    
    if (messageCount > this.maxMessages) {
      this.compact();
    } else if (messageCount >= this.compactAfter && messageCount % 10 === 0) {
      this.compact();
    }
  }

  private compact(): void {
    if (!this.currentSession) return;
    
    const systemMessages = this.currentSession.messages.filter(m => m.role === 'system');
    const recentMessages = this.currentSession.messages.slice(-this.compactAfter);
    
    const summaryMessage: Message = {
      role: 'system',
      content: `[Previous conversation summarized. ${this.currentSession.messages.length} messages were condensed into this summary.]`,
      name: 'system',
    };
    
    this.currentSession.messages = [...systemMessages, summaryMessage, ...recentMessages];
    console.log(`[Session compacted: ${this.currentSession.messages.length} messages]`);
  }
}

let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
