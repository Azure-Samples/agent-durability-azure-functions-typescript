# Simple Agent App - Consolidated Implementation

This is a **single-file, consolidated implementation** with real OpenAI integration. All durable-agent framework boilerplate has been removed, leaving only the essential functionality in one clean `function-app.ts` file.

## Features

- ✅ **Single File**: All functionality consolidated into `function-app.ts`
- ✅ **Real OpenAI Integration**: Uses actual OpenAI API for intelligent reasoning
- ✅ **Zero Boilerplate**: No framework abstractions, just direct implementation
- ✅ **Natural Language Processing**: Handle complex queries with AI understanding
- ✅ **Tool System**: Simple tool decorator and execution with AI-driven selection
- ✅ **In-Memory State**: Lightweight session state management
- ✅ **3 Clean Endpoints**: Chat, state, and health endpoints
- ✅ **Production Ready**: Full OpenAI function calling implementation

## Architecture

```
src/
├── durable-agent-local/          # Local implementation of durable-agent framework
│   ├── types.ts                  # Core type definitions
│   ├── tools.ts                  # Tool decorator and utilities
│   ├── agent.ts                  # DurableAgent class
│   ├── index.ts                  # Main exports
│   ├── core/
│   │   └── AgentRegistry.ts      # Agent registration system
│   ├── runtime/
│   │   ├── logger.ts             # Logging system
│   │   ├── errors.ts             # Error classes
│   │   └── DurableAgentClient.ts # Client for agent execution
│   ├── adapters/
│   │   ├── IAgentAdapter.ts      # Adapter interface
│   │   └── RealOpenAIAdapter.ts  # Real OpenAI integration
│   └── entities/
│       └── AgentEntity.ts        # Entity implementation
└── function-app.ts               # Simplified 3-endpoint function app
```

## Usage

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure OpenAI API Key** in `local.settings.json`:
```json
{
  "Values": {
    "OPENAI_API_KEY": "your-openai-api-key-here"
  }
}
```

3. **Build and start:**
```bash
# Build TypeScript
npm run build

# Start Azure Functions
npm start
```

### API Endpoints

Simplified 3-endpoint architecture:

- `POST /api/entity/chat/{agentName}` - Chat with agent (fire-and-forget)
- `GET /api/entity/state/{agentName}/{sessionKey}` - Get agent state
- `GET /api/core/health` - Health check

### Example Usage

```http
POST http://localhost:7071/api/entity/chat/MathAgent
Content-Type: application/json

{
  "message": "What's the square of 5 plus the factorial of 4?",
  "session_key": "test-session"
}
```

## Tools Available

The math agent includes these tools:

1. **calculateSquare** - Calculate the square of a number
2. **calculateFactorial** - Calculate factorial of a number  
3. **solveEquation** - Solve simple mathematical expressions
4. **hello** - Returns a greeting

## Real OpenAI Integration

The `RealOpenAIAdapter` uses actual OpenAI API for intelligent behavior:

- **Natural Language**: "Can you calculate the square of 7?" → AI understands and calls calculateSquare(7)
- **Multi-step Reasoning**: "What's 5 squared plus 3 factorial?" → AI calls multiple tools and provides final answer
- **Context Understanding**: Complex mathematical requests are intelligently parsed and executed
- **Function Calling**: Uses OpenAI's native function calling for reliable tool execution

## Advantages

This implementation provides **enhanced functionality** compared to pattern matching:

- ✅ **No external `@azure/durable-agent` dependency**
- ✅ **Real AI intelligence** instead of pattern matching
- ✅ **Natural language understanding**
- ✅ **Multi-tool reasoning and chaining**
- ✅ **Simplified 3-endpoint architecture**
- ✅ **Production-ready OpenAI integration**

Perfect for building intelligent agents with real AI capabilities! 🧠✨