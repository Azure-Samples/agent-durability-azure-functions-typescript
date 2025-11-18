# Multi-Agent Azure Functions with Durable Orchestrator

This sample demonstrates how to create and deploy **multiple AI agents** in a single Azure Functions app using the **Durable Agent Orchestrator** pattern. Each agent operates independently with persistent conversation state, specialized tools, and isolated endpoints while sharing infrastructure efficiently.

## 🎯 What This Sample Demonstrates

- **Three Specialized AI Agents** running in one Function App
- **Persistent Conversation State** using Azure Durable Entities  
- **Automatic Tool Calling** with OpenAI Function Calling
- **Session Management** with custom or auto-generated IDs
- **Multi-Agent Isolation** - no naming conflicts or cross-talk
- **Production-Ready Architecture** with error handling and logging

---

## 📋 Prerequisites

### 1. OpenAI API Key (Required)

You need an OpenAI API key to power the AI agents.

**How to get an OpenAI API Key:**
1. Visit [OpenAI Platform](https://platform.openai.com/signup)
2. Create an account or sign in
3. Navigate to **API Keys** section
4. Click **"Create new secret key"**
5. Copy your API key (starts with `sk-...`)
6. **Important**: Keep this key secure and never commit it to version control

### 2. Local Development: Azurite (Required)

For local development, you need **Azurite** (Azure Storage Emulator) because Durable Functions require storage for state management.

**Install Azurite:**
```bash
npm install -g azurite
```

**Start Azurite (in a separate terminal):**
```bash
azurite --silent --location c:\azurite --debug c:\azurite\debug.log
```

### 3. Azure Deployment: Storage Account (Required)

When deploying to Azure, configure a **Storage Account** in your Function App settings:

1. Create an Azure Storage Account
2. Get the connection string from **Access Keys**
3. Set `AzureWebJobsStorage` in your Function App configuration
4. Set `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` to the same value

---

## 🔄 How Durability Works

**Durable Functions** provide stateful operations in serverless environments by persisting execution state across function invocations.

### Key Benefits of Durability:

1. **Conversation Persistence**: Chat history survives between requests
2. **Reliable Execution**: Functions can be interrupted and resumed seamlessly  
3. **Stateful Workflows**: Complex multi-step operations with checkpointing
4. **Scalability**: State is externalized, allowing functions to scale independently
5. **Error Recovery**: Automatic retry and compensation patterns

### How Agents Use Durability:

Each agent creates **three types of durable functions**:

- **🗄️ Conversation Entity**: Stores and manages chat history per session
- **🎭 Chat Orchestrator**: Coordinates the conversation workflow (user input → AI processing → response)
- **⚡ Process Activity**: Handles OpenAI API calls and tool execution

```typescript
// Automatic isolation - each agent gets unique names:
// MathAgent → MathAgentConversationEntity, MathAgentChatOrchestrator, MathAgentProcessChatActivity
// WeatherAgent → WeatherAgentConversationEntity, WeatherAgentChatOrchestrator, WeatherAgentProcessChatActivity
```

---

## 🏗️ Code Architecture & Configuration

### Project Structure
```
src/
├── Tool.ts                      # Tool registry and creation utilities
├── durableAgentOrchestrator.ts  # Durable Functions orchestration logic  
└── function-app.ts              # Multi-agent setup and configuration
```

### Agent Configuration

Each agent is configured with specialized settings:

```typescript
// Math Agent - Higher temperature for creative explanations
const mathAgent = new DurableOpenAiAgentOrchestrator(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'MathAgent',                    // Creates unique function names
    model: 'gpt-4o-mini',               // Cost-effective, fast model
    temperature: 0.7,                    // Moderate creativity
    systemPrompt: 'You are a helpful math assistant...'
  },
  mathToolRegistry
);
```

### Tool Registration Example

Tools are registered declaratively with automatic OpenAI schema generation:

```typescript
// Before: Manual OpenAI function schema + implementation
// After: Declarative definition with auto-generated schema

mathToolRegistry.registerTool(createTool({
  name: 'calculateSquare',
  description: 'Calculate the square of a number',
  parameters: {
    number: createParameter('number', 'The number to square')
  },
  handler: async (number: number) => {
    const result = number * number;
    return `The square of ${number} is ${result}`;
  }
}));
```

### Multi-Agent Isolation

Each agent automatically gets isolated durable functions:

```typescript
mathAgent.run();        // Creates MathAgent* functions + /api/mathagent/* endpoints
weatherAgent.run();     // Creates WeatherAgent* functions + /api/weatheragent/* endpoints  
translationAgent.run(); // Creates TranslationAgent* functions + /api/translationagent/* endpoints
```

---

## 🚀 Local Development Instructions

### Step 1: Prerequisites Setup

1. **Start Azurite** (in separate terminal):
   ```bash
   azurite --silent --location c:\azurite --debug c:\azurite\debug.log
   ```

2. **Configure OpenAI API Key** in `local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "OPENAI_API_KEY": "sk-your-actual-openai-api-key-here"
     }
   }
   ```

### Step 2: Install and Build

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Step 3: Run in VS Code

1. **Open project** in VS Code
2. **Install Azure Functions Extension** if not already installed
3. **Press F5** or use **Run > Start Debugging**
4. **Alternative**: Use terminal: `func start`

### Step 4: Verify Startup

You should see:
```
🚀 Initializing Multi-Agent System...
[AGENT] 🤖 MathAgent initialized with gpt-4o-mini | Tools: calculateSquare, calculateFactorial
[AGENT] 🤖 WeatherAgent initialized with gpt-4o-mini | Tools: getCurrentWeather, getWeatherForecast
[AGENT] 🤖 TranslationAgent initialized with gpt-4o-mini | Tools: translateText
✅ Multi-Agent System Ready!
📍 Available Endpoints: 📊 Math: /api/mathagent/chat/{sessionId} | 🌤️ Weather: /api/weatheragent/chat/{sessionId} | 🗣️ Translation: /api/translationagent/chat/{sessionId} | 📋 Health: /api/{agent}/health

Host lock lease acquired by instance ID '...'
```

---

## 📡 API Endpoints & Usage

> **📋 Important Note about Stateless Endpoints**  
> All chat endpoints (`/api/{agent}/chat/{sessionId}`) are **stateless** and return immediately with processing confirmation. The actual AI response is generated asynchronously. To retrieve the conversation state and AI responses, use the dedicated state endpoint.

### Math Agent Endpoints

**Chat with Math Agent (Stateless):**
```http
POST http://localhost:7071/api/mathagent/chat/my-math-session
Content-Type: application/json

{
  "message": "What is 5 squared and 4 factorial?",
  "sessionId": "my-math-session"
}
```

**Expected Response (Immediate, Stateless):**
```json
{
  "success": true,
  "message": "Chat processing started",
  "sessionId": "my-math-session",
  "instanceId": "d96cf2c50b234aa783c321b82d026fdd",
  "stateEndpoint": "/api/mathagent/state/my-math-session",
  "timestamp": "2025-11-17T04:57:41.980Z",
  "processingTimeMs": 95
}
```

### Weather Agent Endpoints

**Get Weather Information (Stateless):**
```http
POST http://localhost:7071/api/weatheragent/chat/test12
Content-Type: application/json

{
  "message": "What's the weather in San Francisco, CA?",
  "sessionId": "test12"  
}
```

**Expected Response (Immediate, Stateless):**
```json
{
  "success": true,
  "message": "Chat processing started",
  "sessionId": "test12",
  "instanceId": "d96cf2c50b234aa783c321b82d026fdd",
  "stateEndpoint": "/api/weatheragent/state/test12",
  "timestamp": "2025-11-17T04:57:41.980Z",
  "processingTimeMs": 95
}
```

### Translation Agent Endpoints

**Translate Text (Stateless):**
```http
POST http://localhost:7071/api/translationagent/chat/translation-session-789
Content-Type: application/json

{
  "message": "Translate 'hello' to Spanish",
  "sessionId": "translation-session-789"
}
```

**Expected Response (Immediate, Stateless):**
```json
{
  "success": true,
  "message": "Chat processing started",
  "sessionId": "translation-session-789", 
  "instanceId": "d96cf2c50b234aa783c321b82d026fdd",
  "stateEndpoint": "/api/translationagent/state/translation-session-789",
  "timestamp": "2025-11-17T04:57:41.980Z",
  "processingTimeMs": 95
}
```

### Health Check Endpoints

**Check Agent Health:**
```http
GET http://localhost:7071/api/mathagent/health
GET http://localhost:7071/api/weatheragent/health  
GET http://localhost:7071/api/translationagent/health
```

**Expected Health Response:**
```json
{
  "status": "healthy",
  "service": "MathAgent Agent", 
  "version": "1.0.0",
  "agent": {
    "name": "MathAgent",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "availableTools": ["calculateSquare", "calculateFactorial"],
    "toolCount": 2
  },
  "environment": {
    "nodeVersion": "v18.17.0",
    "platform": "win32",
    "openaiConfigured": true
  },
  "timestamp": "2025-11-16T10:03:00.000Z",
  "uptime": 120.5
}
```

### Conversation State Endpoints

> **🔍 Getting AI Responses**  
> Since chat endpoints are stateless, you must use the state endpoint to retrieve the actual AI responses and conversation history. The state endpoint provides the complete conversation context including the AI's processed responses.

**Get Conversation History and AI Responses:**
```http
GET http://localhost:7071/api/weatheragent/state/test12
```

**Expected State Response (Contains AI Response):**
```json
{
  "success": true,
  "sessionId": "test12",
  "messageCount": 2,
  "createdAt": "2025-11-17T04:57:42.144Z",
  "lastUpdated": "2025-11-17T04:57:44.888Z",
  "recentMessages": [
    {
      "role": "user",
      "content": "What's the weather in San Francisco, CA?",
      "timestamp": "2025-11-17T04:57:42.144Z"
    },
    {
      "role": "assistant",
      "content": "The current weather in San Francisco, CA, is sunny with a temperature of 72°F (22°C). There's a light breeze coming from the west, making it a pleasant day to be outdoors. If you're planning any activities, it looks like a great time to enjoy the city's sights!",
      "timestamp": "2025-11-17T04:57:44.888Z"
    }
  ],
  "timestamp": "2025-11-17T04:57:59.951Z",
  "processingTimeMs": 12
}
```

**Usage Pattern for Complete Conversation:**
1. **Send Message**: POST to `/api/{agent}/chat/{sessionId}` (returns immediately)
2. **Get AI Response**: GET from `/api/{agent}/state/{sessionId}` (contains full conversation with AI response)

**State Endpoints for All Agents:**
```http
GET http://localhost:7071/api/mathagent/state/{sessionId}
GET http://localhost:7071/api/weatheragent/state/{sessionId}
GET http://localhost:7071/api/translationagent/state/{sessionId}
```

---

## 🎯 Expected Behavior

### Stateless Chat Architecture
- **Immediate Response**: Chat endpoints return immediately with processing confirmation
- **Asynchronous Processing**: AI processing happens in the background using Durable Functions
- **State Retrieval**: Use state endpoints to get actual AI responses and conversation history
- **Reliability**: Durable Functions ensure processing completes even if there are temporary failures

### Session Management
- **Custom Sessions**: Use your own session IDs for organized conversations
- **Auto-Generated**: Omit sessionId to get auto-generated UUIDs  
- **Persistence**: Conversation history maintained across multiple requests
- **Isolation**: Each agent maintains separate session spaces

### Tool Execution
- **Automatic Detection**: AI automatically identifies when to use tools
- **Sequential Execution**: Multiple tools can be called in one request
- **Error Handling**: Tool failures are gracefully handled and reported
- **Type Safety**: Full TypeScript support for tool parameters

### Multi-Agent Behavior  
- **Independent Operation**: Each agent operates with its own personality and tools
- **No Cross-Talk**: Math sessions don't interfere with Weather sessions
- **Shared Infrastructure**: All agents share the same Function App and OpenAI API key
- **Unique Endpoints**: Each agent has its own set of HTTP endpoints

This architecture provides a robust foundation for building sophisticated multi-agent AI applications with persistent state, automatic scaling, and production-ready reliability.