# myopencode

A CLI AI coding agent similar to opencode. Supports multiple models, memory management, skills, and MCP.

## Installation

```bash
npm install
npm run build
```

## Configuration

Create `~/.myopencode/config.json`:

```json
{
  "providers": {
    "deepseek": {
      "apiKey": "your-api-key",
      "baseUrl": "https://api.deepseek.com"
    }
  },
  "defaultModel": "deepseek/deepseek-chat"
}
```

## Usage

```bash
# Run a single prompt
myopencode run "Explain closures in JavaScript"

# Start interactive chat
myopencode chat

# Manage configuration
myopencode config list
myopencode config provider add deepseek <api-key> <base-url>
myopencode config model deepseek/deepseek-chat

# Manage sessions
myopencode session list
myopencode session show <id>
```

## Features

- Multiple model providers (OpenAI, Anthropic, DeepSeek, and any OpenAI-compatible API)
- Session-based memory with automatic compaction
- Skills system (AgentSkills-compatible)
- MCP client support
- Built-in tools (read, write, edit, bash, glob, grep, websearch)
