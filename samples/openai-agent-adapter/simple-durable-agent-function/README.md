# Simple Math Agent - Azure Functions with Durable Orchestrator

This sample demonstrates how to create and deploy a **single AI agent** in Azure Functions using the **Durable Agent Orchestrator** pattern. The agent operates with persistent conversation state, specialized mathematical tools, and a clean API architecture.

## 🎯 What This Sample Demonstrates

- **Single Specialized AI Agent** (Math Agent) with mathematical capabilities
- **Persistent Conversation State** using Azure Durable Entities  
- **Automatic Tool Calling** with OpenAI Function Calling
- **Session Management** with custom or auto-generated IDs
- **Stateless HTTP Endpoints** with asynchronous processing
- **Production-Ready Architecture** with error handling and logging

---

## 📋 Prerequisites

### 1. OpenAI API Key (Required)

You need an OpenAI API key to power the AI agent.

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

### How the Math Agent Uses Durability:

The agent creates **three types of durable functions**:

- **🗄️ Conversation Entity**: Stores and manages chat history per session
- **🎭 Chat Orchestrator**: Coordinates the conversation workflow (user input → AI processing → response)
- **⚡ Process Activity**: Handles OpenAI API calls and tool execution

```typescript
// The Math Agent gets these durable functions:
// MathAgent → MathAgentConversationEntity, MathAgentChatOrchestrator, MathAgentProcessChatActivity
```

---

## 🏗️ Code Architecture & Configuration

### Project Structure
```
src/
├── Tool.ts                      # Tool registry and creation utilities
├── durableAgentOrchestrator.ts  # Durable Functions orchestration logic  
└── function-app.ts              # Math agent setup and configuration
```

### Agent Configuration

The Math Agent is configured with specialized mathematical settings:

```typescript
// Math Agent - Higher temperature for creative explanations
const agent = new DurableOpenAiAgentOrchestrator(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'MathAgent',                    // Creates unique function names
    model: 'gpt-4o-mini',               // Cost-effective, fast model
    temperature: 0.7,                    // Moderate creativity
    systemPrompt: 'You are a helpful math assistant that can calculate squares, factorials, and solve simple expressions. Always use the provided tools for calculations and explain your work step by step.'
  },
  toolRegistry
);
```

### Tool Registration Example

Tools are registered declaratively with automatic OpenAI schema generation:

```typescript
// Before: Manual OpenAI function schema + implementation
// After: Declarative definition with auto-generated schema

toolRegistry.registerTool(createTool({
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

### Math Agent Deployment

The agent automatically creates isolated durable functions:

```typescript
agent.run(); // Creates MathAgent* functions + /api/mathagent/* endpoints
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
🎉 Math Agent deployed successfully! Ready to solve mathematical problems.

Host lock lease acquired by instance ID '...'
```

---

### API Endpoints

> **📋 Important Note about Stateless Endpoints**  
> The chat endpoint (`/api/entity/chat/{agentName}`) is **stateless** and returns immediately with processing confirmation. The actual AI response is generated asynchronously. To retrieve the conversation state and AI responses, use the dedicated state endpoint.

Simplified 3-endpoint architecture:

- `POST /api/entity/chat/{agentName}` - Chat with agent (stateless, returns immediately)
- `GET /api/entity/state/{agentName}/{sessionKey}` - Get agent state and AI responses
- `GET /api/core/health` - Health check

### Math Agent Chat Endpoint

**Chat with Math Agent (Stateless):**
```http
POST http://localhost:7071/api/entity/chat/MathAgent
Content-Type: application/json

{
  "message": "What is 5 squared and 4 factorial?",
  "session_key": "my-math-session"
}
```

**Expected Response (Immediate, Stateless):**
```json
{
  "success": true,
  "message": "Chat processing started",
  "sessionId": "my-math-session",
  "instanceId": "d96cf2c50b234aa783c321b82d026fdd",
  "stateEndpoint": "/api/entity/state/MathAgent/my-math-session",
  "timestamp": "2025-11-17T04:57:41.980Z",
  "processingTimeMs": 95
}
```

### Math Agent State Endpoint

> **🔍 Getting AI Responses**  
> Since the chat endpoint is stateless, you must use the state endpoint to retrieve the actual AI responses and conversation history. The state endpoint provides the complete conversation context including the AI's processed responses.

**Get Conversation History and AI Responses:**
```http
GET http://localhost:7071/api/entity/state/MathAgent/my-math-session
```

**Expected State Response (Contains AI Response):**
```json
{
  "success": true,
  "sessionId": "my-math-session",
  "messageCount": 2,
  "createdAt": "2025-11-17T04:57:42.144Z",
  "lastUpdated": "2025-11-17T04:57:44.888Z",
  "recentMessages": [
    {
      "role": "user",
      "content": "What is 5 squared and 4 factorial?",
      "timestamp": "2025-11-17T04:57:42.144Z"
    },
    {
      "role": "assistant",
      "content": "I'll help you with those calculations!\n\nFor 5 squared: The square of 5 is 25\nFor 4 factorial: The factorial of 4 is 24\n\nSo 5² = 25 and 4! = 24",
      "timestamp": "2025-11-17T04:57:44.888Z"
    }
  ],
  "timestamp": "2025-11-17T04:57:59.951Z",
  "processingTimeMs": 12
}
```

**Usage Pattern for Complete Conversation:**
1. **Send Message**: POST to `/api/entity/chat/MathAgent` (returns immediately)
2. **Get AI Response**: GET from `/api/entity/state/MathAgent/{sessionKey}` (contains full conversation with AI response)

### Health Check Endpoint

**Check Math Agent Health:**
```http
GET http://localhost:7071/api/core/health
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
    "availableTools": ["calculateSquare", "calculateFactorial", "solveEquation", "hello"],
    "toolCount": 4
  },
  "environment": {
    "nodeVersion": "v18.17.0",
    "platform": "win32",
    "openaiConfigured": true
  },
  "timestamp": "2025-11-17T04:57:59.951Z",
  "uptime": 120.5
}
```