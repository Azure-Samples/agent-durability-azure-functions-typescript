# Multi-Agent Azure Functions Sample

This sample demonstrates how to create multiple AI agents in a single Azure Functions app using the simplified Tool and DurableWrapper APIs. Each agent operates independently with its own tools and conversation state, while sharing the same function app infrastructure.

## Features

- **🤖 Three Specialized Agents**:
  - **MathAgent**: Performs mathematical calculations (squares, factorials)
  - **WeatherAgent**: Provides weather information and forecasts
  - **TranslationAgent**: Translates text between languages

- **🔧 Simplified Architecture**:
  - **Tool.ts**: Declarative tool definition with automatic schema generation
  - **durableWrapper.ts**: One-line agent setup with built-in durable functions
  - **function-app.ts**: Clean multi-agent configuration (127 lines total)

- **🚀 Automatic Isolation**:
  - Each agent gets unique durable function names (no conflicts)
  - Independent conversation states per agent
  - Separate tool registries and configurations

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure OpenAI API Key
Edit `local.settings.json`:
```json
{
  "Values": {
    "OPENAI_API_KEY": "your-actual-openai-api-key"
  }
}
```

### 3. Build and Run
```bash
npm run build
npm start
```

### 4. Test the Agents

**Math Agent:**
```bash
POST http://localhost:7071/api/agent/chat/math-session-123
{
  "message": "What is 5 squared and 4 factorial?"
}
```

**Weather Agent:**
```bash  
POST http://localhost:7071/api/agent/chat/weather-session-456
{
  "message": "What's the weather in San Francisco, CA?"
}
```

**Translation Agent:**
```bash
POST http://localhost:7071/api/agent/chat/translation-session-789
{
  "message": "Translate 'hello' to Spanish"
}
```

## Architecture Benefits

### Multi-Agent Isolation
```typescript
// Each agent creates unique durable functions:
// MathAgent → MathAgentConversationEntity, MathAgentChatOrchestrator
// WeatherAgent → WeatherAgentConversationEntity, WeatherAgentChatOrchestrator  
// TranslationAgent → TranslationAgentConversationEntity, TranslationAgentChatOrchestrator

mathAgent.run();    // Creates MathAgent* functions
weatherAgent.run(); // Creates WeatherAgent* functions
translationAgent.run(); // Creates TranslationAgent* functions
```

### Simplified Tool Definition
```typescript
// Before: Manual OpenAI schema + function implementation
// After: Declarative definition with auto-generated schema

toolRegistry.registerTool(createTool({
  name: 'calculateSquare',
  description: 'Calculate the square of a number',
  parameters: {
    number: createParameter('number', 'The number to square')
  },
  handler: async (number: number) => {
    return `The square of ${number} is ${number * number}`;
  }
}));
```

### One-Line Agent Setup
```typescript  
// Before: 600+ lines of durable function boilerplate
// After: Single method call with automatic setup

const agent = new DurableOpenAiAgentWrapper(apiKey, config, toolRegistry);
agent.run(); // ← Creates all durable functions + HTTP endpoints
```

## Available Endpoints

Each agent exposes unique endpoints with isolated session management:

### Math Agent
- **POST** `/api/mathagent/chat/{sessionId?}` - Chat with math agent
- **GET** `/api/mathagent/state/{sessionId}` - Get conversation history  
- **GET** `/api/mathagent/health` - Health check

### Weather Agent  
- **POST** `/api/weatheragent/chat/{sessionId?}` - Chat with weather agent
- **GET** `/api/weatheragent/state/{sessionId}` - Get conversation history
- **GET** `/api/weatheragent/health` - Health check

### Translation Agent
- **POST** `/api/translationagent/chat/{sessionId?}` - Chat with translation agent
- **GET** `/api/translationagent/state/{sessionId}` - Get conversation history
- **GET** `/api/translationagent/health` - Health check

## Session Management

### SessionId Input Options

**Option 1: Provide sessionId in JSON body (Recommended)**
```json
{
  "message": "What is 5 squared?",
  "sessionId": "my-math-session"
}
```
→ Uses session: `my-math-session` (exactly as provided)

**Option 2: Use URL parameter**
```
POST /api/mathagent/chat/my-session-123
```
→ Uses session: `my-session-123`

**Option 3: Auto-generated session**
```json
{
  "message": "What is 5 squared?"
}
```
→ Creates session: `session-{guid}`

### Response Format
```json
{
  "success": true,
  "message": "The square of 5 is 25",
  "sessionId": "my-math-session",
  "instanceId": "orchestrator-guid",
  "stateEndpoint": "/api/mathagent/state/my-math-session",
  "timestamp": "2025-11-14T10:00:00.000Z",
  "processingTimeMs": 1500
}
```

### Session Isolation
- **Unique per agent**: MathAgent sessions are separate from WeatherAgent sessions
- **Customer control**: Use provided sessionIds exactly as given (no modifications)
- **Persistent state**: Conversation history maintained across multiple requests

## Code Structure

```
src/
├── Tool.ts              # Tool definition and registry wrapper
├── durableWrapper.ts    # Durable Functions abstraction  
└── function-app.ts      # Multi-agent setup (127 lines)
```

## Benefits Over Manual Implementation

| Feature | Manual Implementation | With Wrappers |
|---------|---------------------|---------------|
| **Lines of Code** | ~2000+ lines | 127 lines |
| **Agent Definition** | Manual durable functions | Single method call |
| **Tool Setup** | Manual schema creation | Declarative objects |
| **Multi-Agent Support** | Complex naming management | Automatic isolation |
| **Error Handling** | Manual try/catch everywhere | Built-in |
| **Logging** | Manual console.log | Structured logging |
| **Type Safety** | Partial | Full TypeScript |

## Extending the Sample

### Add New Agent
```typescript
const newToolRegistry = new ToolRegistry();
newToolRegistry.registerTool(createTool({ /* tool definition */ }));

const newAgent = new DurableOpenAiAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'NewAgent', // Creates NewAgentConversationEntity, etc.
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant...'
  },
  newToolRegistry
);

newAgent.run(); // Automatically isolated from other agents
```

### Add New Tool
```typescript
toolRegistry.registerTool(createTool({
  name: 'newTool',
  description: 'Does something useful',
  parameters: {
    param1: createParameter('string', 'Description of param1'),
    param2: createParameter('number', 'Description of param2', false) // optional
  },
  handler: async (param1: string, param2?: number) => {
    // Tool implementation
    return `Result: ${param1} ${param2}`;
  }
}));
```

This sample shows how the wrapper libraries transform complex multi-agent scenarios into simple, maintainable code while providing production-ready features like error handling, logging, and conversation persistence.