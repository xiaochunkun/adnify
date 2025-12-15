# Adnify

A minimal AI-powered code editor with Agent and Chat modes. Built with Electron, React, Monaco Editor, and TypeScript.

![Adnify](https://via.placeholder.com/800x500/0d1117/58a6ff?text=Mini+Editor)

## Features

- 🎨 **Modern UI** - Clean, dark-themed interface with smooth animations
- 📝 **Monaco Editor** - Full-featured code editor with syntax highlighting
- 🤖 **AI Chat Mode** - Conversational AI assistant for coding help
- ⚡ **AI Agent Mode** - Autonomous agent that can read, write, and modify files
- 🔌 **Multi-Provider Support** - Works with OpenAI, Anthropic Claude, and Google Gemini
- 📁 **File Explorer** - Browse and manage your project files

## Supported AI Providers

| Provider | Models |
|----------|--------|
| OpenAI | GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo |
| Anthropic | Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus |
| Google | Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
cd mini-editor

# Install dependencies
npm install

# Start development server
npm run dev

# In another terminal, start Electron
npm start
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

### Chat Mode
Ask questions about your code, get explanations, and receive suggestions. The AI will respond conversationally without modifying any files.

### Agent Mode
The AI can autonomously:
- Read file contents
- Write and modify files
- List directory contents
- Search for text in files
- Create directories
- Delete files

Simply describe what you want to accomplish, and the agent will execute the necessary steps.

## Configuration

Click the Settings icon in the title bar to configure:
- **Provider**: Choose between OpenAI, Anthropic, or Google
- **Model**: Select the specific model to use
- **API Key**: Enter your API key for the selected provider
- **Base URL** (OpenAI only): Custom endpoint for OpenAI-compatible APIs

## Project Structure

```
mini-editor/
├── src/
│   ├── main/           # Electron main process
│   │   ├── llm/        # LLM service and providers
│   │   ├── main.ts     # Main entry point
│   │   └── preload.ts  # Preload script
│   └── renderer/       # React frontend
│       ├── agent/      # Agent tools and logic
│       ├── components/ # React components
│       ├── hooks/      # Custom hooks
│       ├── store/      # Zustand state management
│       └── styles/     # CSS styles
├── index.html
├── package.json
└── vite.config.ts
```

## Tech Stack

- **Electron** - Desktop application framework
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Monaco Editor** - Code editor
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **OpenAI/Anthropic/Google SDKs** - AI providers

## License

MIT
