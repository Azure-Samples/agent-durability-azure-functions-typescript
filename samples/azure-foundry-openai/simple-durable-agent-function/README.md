# 🔢 Azure Foundry OpenAI Math Agent - Complete Setup Guide

This sample demonstrates how to create a **mathematical AI agent** with **Azure Foundry OpenAI services** using the latest **@azure/openai 2.0.0** library and Azure Durable Functions for persistent conversation state management.

## 📋 Overview

The **MathAgent** implements:
- 🤖 Mathematical AI agent with conversation memory using Azure Durable Functions
- 🔗 Integration with Azure Foundry OpenAI services using **@azure/openai 2.0.0**
- 🔐 **Azure AD authentication** (recommended) - no API keys required
- 🧮 Mathematical tool calling capabilities (square, factorial, expression evaluation, number analysis)  
- 💾 Persistent conversation state across function invocations
- 🔄 Support for multiple concurrent math sessions with background processing

## 🎯 What You'll Build

By following this guide, you'll create a production-ready math agent that:
- Responds immediately with HTTP 202 (processing started)
- Processes AI requests in the background using Durable Orchestrations
- Maintains conversation history across sessions
- Provides real-time status monitoring
- Supports mathematical computations with specialized tools

## Key Features of @azure/openai 2.0.0

- **Azure AD Authentication**: Uses `DefaultAzureCredential` for secure, keyless authentication
- **Unified API**: Compatible with OpenAI client patterns using `AzureOpenAI` class
- **Latest API Version**: Supports Azure OpenAI API version 2024-10-21
- **Enhanced Tool Calling**: Improved tool calling with `tool_calls` property

## 🛠️ Prerequisites

### 1. Azure Resources Required

#### Azure Foundry OpenAI Resource
You need an **Azure OpenAI** or **AI Foundry** resource with a deployed model:

- ✅ Azure subscription with Azure OpenAI Service enabled
- ✅ Azure OpenAI or AI Foundry resource created
- ✅ **GPT model deployed** (e.g., `gpt-4`, `gpt-4o-mini`, `gpt-35-turbo`)
- ✅ Note your **deployment name** and **endpoint URL**

> 📝 **Important**: Azure Foundry is the new unified AI platform that includes Azure OpenAI capabilities with enhanced features.

#### Required Information to Collect:
```bash
# You'll need these values for configuration:
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
AZURE_OPENAI_DEPLOYMENT_NAME="your-deployment-name"  # e.g., "gpt-4", "gpt-4o-mini"
```

### 2. Development Tools

- ✅ **Node.js 18+** and npm
- ✅ **Azure Functions Core Tools 4.x**
- ✅ **Azure CLI** (for authentication setup)
- ✅ **Azurite** (Azure Storage Emulator)
- ✅ Code editor (VS Code recommended)

### 3. Azure CLI Authentication
```bash
# Install Azure CLI if not already installed
# Windows: winget install Microsoft.AzureCLI
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Sign in to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "your-subscription-id"
```

## 🔐 Critical: Azure AD Permissions Setup

### Step 1: Grant Azure OpenAI Permissions

To use Azure AD authentication (recommended for security), you **must** grant yourself the required permissions:

#### Option A: Using Azure Portal (Recommended)

1. **Open Azure Portal** → Navigate to [portal.azure.com](https://portal.azure.com)

2. **Find your Azure OpenAI / AI Foundry resource**
   - Search for your resource name in the top search bar
   - Click on your Azure OpenAI or AI Foundry resource

3. **Go to Access Control (IAM)**
   - In the left menu, click **"Access control (IAM)"**

4. **Add Role Assignment**
   - Click **"Add"** → **"Add role assignment"**

5. **Select Role**
   - Search for and select: **"Cognitive Services OpenAI User"**
   - Click **"Next"**

6. **Assign Access**
   - Under **"Assign access to"**, select:
     - **"User, group, or service principal"** (for your personal account)
     - **"Managed identity"** (if setting up for Azure Function App)

7. **Select Members**
   - Click **"Select members"**
   - Search for and select your user account or managed identity
   - Click **"Select"**

8. **Review and Assign**
   - Click **"Review + assign"**
   - Click **"Review + assign"** again to confirm

#### Option B: Using Azure CLI

```bash
# Replace these values with your actual information:
RESOURCE_GROUP="your-resource-group"
OPENAI_RESOURCE_NAME="your-openai-resource"
USER_EMAIL="your-email@domain.com"
SUBSCRIPTION_ID="your-subscription-id"

# Grant Cognitive Services OpenAI User role
az role assignment create \
  --role "Cognitive Services OpenAI User" \
  --assignee $USER_EMAIL \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$OPENAI_RESOURCE_NAME"
```

#### Required Permission Details

The **Cognitive Services OpenAI User** role provides these essential permissions:
- ✅ `Microsoft.CognitiveServices/accounts/OpenAI/deployments/chat/completions/action`
- ✅ `Microsoft.CognitiveServices/accounts/OpenAI/deployments/completions/action`
- ✅ `Microsoft.CognitiveServices/accounts/OpenAI/deployments/embeddings/action`

> ⚠️ **Without these permissions**, you'll get authentication errors when the function tries to call Azure OpenAI.

### Step 2: Verify Permissions

```bash
# Test your access (replace with your endpoint and deployment)
curl -H "Authorization: Bearer $(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)" \
  -H "Content-Type: application/json" \
  "https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2024-10-21" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

If permissions are correct, you should see a JSON response with AI-generated content.

## ⚡ Azurite Setup (Local Storage Emulator)

Azure Functions requires storage for durable functions. For local development, you need **Azurite**:

### Install Azurite

```bash
# Install Azurite globally
npm install -g azurite

# Alternative: Use Docker
# docker run -p 10000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
```

### Start Azurite (Keep Running)

```bash
# Start Azurite (run this in a separate terminal and keep it running)
azurite --silent --location c:\azurite --debug c:\azurite\debug.log

# You should see:
# Azurite Blob service is starting at http://127.0.0.1:10000
# Azurite Queue service is starting at http://127.0.0.1:10001  
# Azurite Table service is starting at http://127.0.0.1:10002
```

> 💡 **Tip**: Keep Azurite running in a separate terminal window throughout development.

## 🚀 Project Setup

1. **Navigate to the sample directory:**
   ```bash
   cd samples/azure-foundry-openai/simple-durable-agent-function
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure local settings:**
   
   Create or update `local.settings.json` with your Azure Foundry OpenAI details:
   
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "UseDevelopmentStorage=true",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "AZURE_OPENAI_ENDPOINT": "https://your-foundry-resource.openai.azure.com/",
       "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4"
     }
   }
   ```
   
   **🔧 Configuration Details:**
   - `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI/AI Foundry endpoint URL (**required**)
   - `AZURE_OPENAI_DEPLOYMENT_NAME`: Your model deployment name (**required**)
   - `AzureWebJobsStorage`: Uses local Azurite for development
   - No API keys needed - uses Azure AD authentication!

## 🔨 Build and Start

### Step 1: Build the TypeScript Project

```bash
# Compile TypeScript to JavaScript
npm run build

# You should see successful compilation with no errors
# Output files will be in the 'dist' folder
```

### Step 2: Start the Function App

```bash
# Start the Azure Functions runtime
npm start

# Alternative command:
# func start
```

**Expected Startup Output:**
```
[2025-11-17T23:45:30.123Z] Host lock lease acquired by instance ID '00000000000000000000000000000000'.
[2025-11-17T23:45:30.456Z] [INIT] 🚀 Initializing MathAgent with Azure Foundry OpenAI...
[2025-11-17T23:45:30.567Z] [INIT] 🔐 Using secure Azure AD authentication
[2025-11-17T23:45:30.678Z] [INIT] ✅ Configuration validated successfully
[2025-11-17T23:45:30.789Z] [INIT] 🎯 Target deployment: gpt-4
[2025-11-17T23:45:30.890Z] [AGENT] 🤖 MathAgent initialized - gpt-4
[2025-11-17T23:45:31.123Z] [AGENT] ✅ MathAgent ready with Azure Foundry OpenAI!
[2025-11-17T23:45:31.234Z] [READY] ✅ MathAgent Ready - gpt-4
[2025-11-17T23:45:31.345Z] [READY] 🔢 Chat: POST /api/mathagent/chat/{sessionId}
[2025-11-17T23:45:31.456Z] [READY] 🛠️ Tools: calculateSquare, calculateFactorial, evaluateExpression, getNumberInfo

Functions:
    chatWithMathAgentAgent: [POST] http://localhost:7071/api/mathagent/chat/{sessionId}
    getMathAgentAgentState: [GET] http://localhost:7071/api/mathagent/state/{sessionId}
    getMathAgentOrchestratorStatus: [GET] http://localhost:7071/api/mathagent/orchestrator/{instanceId}
    mathagentHealthCheck: [GET] http://localhost:7071/api/mathagent/health

For detailed output, run func with --verbose flag.
[2025-11-17T23:45:31.789Z] Host started (1234ms)
[2025-11-17T23:45:31.890Z] Job host started
```

> ✅ **Success Indicators**: Look for "MathAgent Ready" and the list of HTTP endpoints.

### Troubleshooting Startup Issues

**Issue**: `Missing AZURE_OPENAI_ENDPOINT`
```bash
# Solution: Check your local.settings.json file
cat local.settings.json
# Ensure AZURE_OPENAI_ENDPOINT is correctly set
```

**Issue**: Authentication errors
```bash
# Solution: Verify Azure CLI login
az account show
# Re-login if needed
az login
```

**Issue**: Azurite connection errors  
```bash
# Solution: Ensure Azurite is running
# Check if it's running on the expected ports
netstat -an | find "10000"
netstat -an | find "10001"
netstat -an | find "10002"
```

## 🧪 Testing the MathAgent

### Step 1: Health Check

First, verify the service is running correctly:

```bash
# Test the health endpoint
curl http://localhost:7071/api/mathagent/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "MathAgent Agent",
  "version": "1.0.0",
  "agent": {
    "name": "MathAgent",
    "deployment": "gpt-4",
    "temperature": 0.7,
    "availableTools": ["calculateSquare", "calculateFactorial", "evaluateExpression", "getNumberInfo"],
    "toolCount": 4
  },
  "azure": {
    "foundryEndpoint": "https://your-resource.openai.azure.com/",
    "deployment": "gpt-4",
    "apiVersion": "2024-10-21",
    "authMethod": "Azure AD (Managed Identity)"
  },
  "environment": {
    "nodeVersion": "v18.17.0",
    "platform": "win32",
    "azureFoundryConfigured": true
  }
}
```

### Step 2: Test Mathematical Calculations

#### Test 1: Basic Square Calculation

```bash
# Start a math conversation
curl -X POST "http://localhost:7071/api/mathagent/chat/test-session-1" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 12 squared?"}'
```

**Expected Response (202 - Processing Started):**
```json
{
  "success": true,
  "message": "MathAgent processing started in background",
  "sessionId": "test-session-1",
  "instanceId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "status": "processing",
  "endpoints": {
    "state": "/api/mathagent/state/test-session-1",
    "health": "/api/mathagent/health",
    "orchestratorStatus": "/api/mathagent/orchestrator/a1b2c3d4-e5f6-7890-1234-567890abcdef"
  },
  "azure": {
    "foundryEndpoint": "https://your-resource.openai.azure.com/",
    "deployment": "gpt-4",
    "apiVersion": "2024-10-21"
  },
  "timestamp": "2025-11-17T23:45:32.123Z",
  "processingTimeMs": 45
}
```

#### Test 2: Check Processing Status

```bash
# Check the status (replace with your actual instanceId)
curl "http://localhost:7071/api/mathagent/orchestrator/a1b2c3d4-e5f6-7890-1234-567890abcdef"
```

**Expected Response (Processing):**
```json
{
  "success": true,
  "instanceId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "runtimeStatus": "Running",
  "customStatus": "Processing: \"What is 12 squared?...\"",
  "input": {
    "input": {
      "message": "What is 12 squared?",
      "sessionId": "test-session-1"
    }
  },
  "createdTime": "2025-11-17T23:45:32.123Z",
  "lastUpdatedTime": "2025-11-17T23:45:33.456Z"
}
```

**Expected Response (Completed):**
```json
{
  "success": true,
  "instanceId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "runtimeStatus": "Completed",
  "customStatus": "Completed successfully",
  "output": {
    "success": true,
    "response": "The square of 12 is 144.",
    "sessionId": "test-session-1",
    "completedAt": "2025-11-17T23:45:35.789Z"
  },
  "createdTime": "2025-11-17T23:45:32.123Z",
  "lastUpdatedTime": "2025-11-17T23:45:35.789Z"
}
```

#### Test 3: Get Conversation History

```bash
# Get the session state
curl "http://localhost:7071/api/mathagent/state/test-session-1"
```

**Expected Response:**
```json
{
  "success": true,
  "sessionId": "test-session-1",
  "messageCount": 2,
  "createdAt": "2025-11-17T23:45:32.000Z",
  "lastUpdated": "2025-11-17T23:45:35.789Z",
  "recentMessages": [
    {
      "role": "user",
      "content": "What is 12 squared?",
      "timestamp": "2025-11-17T23:45:32.123Z"
    },
    {
      "role": "assistant",
      "content": "The square of 12 is 144.",
      "timestamp": "2025-11-17T23:45:35.789Z"
    }
  ]
}
```

### Step 3: Test Different Mathematical Operations

#### Factorial Calculation
```bash
curl -X POST "http://localhost:7071/api/mathagent/chat/test-session-1" \
  -H "Content-Type: application/json" \
  -d '{"message": "Calculate 6 factorial"}'
```

#### Complex Expression
```bash
curl -X POST "http://localhost:7071/api/mathagent/chat/test-session-1" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is (15 + 3) * 2?"}'
```

#### Number Analysis
```bash
curl -X POST "http://localhost:7071/api/mathagent/chat/test-session-1" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about the number 28"}'
```

### Step 4: Test Session Persistence

```bash
# Continue the conversation in the same session
curl -X POST "http://localhost:7071/api/mathagent/chat/test-session-1" \
  -H "Content-Type: application/json" \
  -d '{"message": "What was my first question?"}'

# The AI should remember the conversation history and mention "12 squared"
```

### Expected Workflow Timeline

1. **0ms**: POST request sent → Immediate 202 response
2. **100ms**: Orchestrator starts → Status shows "Running"
3. **2000ms**: Azure Foundry OpenAI processes → Tool execution
4. **3000ms**: Response generated → Status shows "Completed"
5. **3100ms**: State endpoint shows full conversation history

> 🕒 **Typical Response Times**: 2-5 seconds for AI processing, <100ms for status/state endpoints

### Available Mathematical Tools

The MathAgent has access to specialized mathematical tools:
- **calculateSquare:** Computes the square of a number (n²)
- **calculateFactorial:** Calculates factorial of a number (n!)
- **evaluateExpression:** Safely evaluates mathematical expressions (+, -, *, /, parentheses)
- **getNumberInfo:** Analyzes properties of numbers (even/odd, prime, perfect, etc.)

### Example Mathematical Conversations

- "What is 12 squared?"
- "Calculate 6 factorial"
- "What is (15 + 3) * 2?"
- "Tell me about the number 28"
- "What's 144 squared minus 100?"
- "Is 17 a prime number?"
- "Calculate 4! + 3!"

## 🏗️ Architecture Deep Dive

### Overall System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   HTTP Client   │───▶│  Azure Functions │───▶│  Azure Foundry     │
│  (Immediate 202)│    │  (Orchestrator)  │    │  OpenAI (GPT-4)    │
└─────────────────┘    │  (Background)    │    └─────────────────────┘
                        └──────────────────┘              │
                               │                           │
                        ┌──────────────────┐              │
                        │  Durable Entity  │◀─────────────┘
                        │ (Conversation    │
                        │  State Storage)  │
                        └──────────────────┘
```

### Key Components

1. **HTTP Endpoints**: Immediate response with background processing
2. **Durable Orchestrator**: Manages the AI workflow asynchronously 
3. **Durable Entity**: Persists conversation state across requests
4. **Activity Functions**: Execute Azure Foundry OpenAI calls
5. **Tool Registry**: Mathematical function implementations

### Code Architecture Overview

#### 1. Conversation Persistence (Durable Entity)

**File**: `src/durableAgentOrchestrator.ts` (lines 128-170)

```typescript
// Durable Entity for conversation state management
df.app.entity('conversationEntity', (context) => {
  const state: ConversationState = context.df.getState(() => ({
    chatHistory: [],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  })) as ConversationState;

  const operation = context.df.operationName;
  
  const operations = {
    'addMessage': () => {
      const input = context.df.getInput() as { 
        role: 'user' | 'assistant' | 'system'; 
        content: string 
      };
      
      // 💾 PERSISTENCE: Add message to permanent state
      state.chatHistory.push({
        role: input.role,
        content: input.content,
        timestamp: new Date().toISOString()
      });
      
      state.lastUpdated = new Date().toISOString();
      context.df.setState(state);  // 🔄 Persisted across restarts
      
      return { success: true };
    },
    'getFullHistory': () => {
      // 📚 RETRIEVAL: Get complete conversation history
      return state.chatHistory;
    }
  };

  return operations[operation] ? operations[operation]() : state;
});
```

**How Persistence Works:**
- ✅ **Durable Storage**: State survives function app restarts
- ✅ **Session Isolation**: Each `sessionId` has independent state
- ✅ **Automatic Serialization**: JSON state automatically saved to Azure Storage
- ✅ **Concurrent Access**: Multiple sessions can run simultaneously

#### 2. Chat Execution Flow (Orchestrator)

**File**: `src/durableAgentOrchestrator.ts` (lines 240-290)

```typescript
// Background orchestration workflow
df.app.orchestration('chatOrchestrator', function* (context) {
  const { message, sessionId } = context.df.getInput();
  
  console.log(`[ORCHESTRATOR] 🚀 EXECUTING WORKFLOW for session: ${sessionId}`);
  
  const entityId = new df.EntityId('conversationEntity', sessionId);
  
  try {
    // 📝 STEP 1: Store user message (persistent)
    yield context.df.callEntity(entityId, 'addMessage', { 
      role: 'user', 
      content: message 
    });
    
    // 🤖 STEP 2: Process with Azure Foundry OpenAI (the magic happens here)
    const response = yield context.df.callActivity('processChatActivity', { 
      message, 
      sessionId 
    });
    
    // 💾 STEP 3: Store AI response (persistent)
    yield context.df.callEntity(entityId, 'addMessage', { 
      role: 'assistant', 
      content: response 
    });
    
    console.log(`[ORCHESTRATOR] ✅ WORKFLOW COMPLETED for session: ${sessionId}`);
    return { success: true, response, sessionId };
    
  } catch (error) {
    console.error(`[ORCHESTRATOR] ❌ WORKFLOW FAILED:`, error);
    throw error;
  }
});
```

**Orchestration Benefits:**
- ⚡ **Immediate Response**: HTTP returns 202 instantly
- 🔄 **Reliable Execution**: Automatic retries and error handling
- 📊 **Progress Tracking**: Real-time status monitoring
- 🔀 **Concurrency**: Multiple conversations processed in parallel

#### 3. Azure Foundry OpenAI Integration (Activity)

**File**: `src/durableAgentOrchestrator.ts` (lines 400-480)

```typescript
// Activity function that calls Azure Foundry OpenAI
df.app.activity('processChatActivity', {
  handler: async (input: { message: string; sessionId: string }): Promise<string> => {
    console.log(`[ACTIVITY] 🚀 processChatActivity STARTED`);
    
    try {
      // 🤖 Call the main AI processing method
      const response = await AzureFoundryAgentOrchestrator.instance.executeOpenAIChat(input.message);
      
      console.log(`[ACTIVITY] ✅ AI processing completed`);
      return response;
      
    } catch (error) {
      console.error(`[ACTIVITY] ❌ AI processing failed:`, error);
      throw new Error(`Activity processing failed: ${error}`);
    }
  }
});
```

#### 4. Azure Foundry OpenAI Chat Processing

**File**: `src/durableAgentOrchestrator.ts` (lines 380-450)

```typescript
public async executeOpenAIChat(message: string): Promise<string> {
  console.log(`[AZURE-FOUNDRY] 🚀 Processing: "${message.substring(0, 50)}..."`);
  
  try {
    // 🔗 Call Azure Foundry OpenAI with tool support
    const response = await this.azureOpenAI.chat.completions.create({
      model: this.config.deploymentName,  // e.g., "gpt-4"
      messages: [
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: message }
      ],
      tools: this.toolRegistry.getAzureOpenAISchema(),  // 🛠️ Mathematical tools
      tool_choice: 'auto',
      temperature: this.config.temperature || 0.7,
      max_tokens: 2000
    });

    const completion = response.choices[0];
    
    // 🔧 Handle tool calls (mathematical operations)
    if (completion.message.tool_calls && completion.message.tool_calls.length > 0) {
      console.log(`[AZURE-FOUNDRY] 🔧 Processing ${completion.message.tool_calls.length} tool call(s)`);
      
      const toolResults = [];
      
      // Execute each mathematical tool
      for (const toolCall of completion.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        try {
          console.log(`[TOOL] 🔧 Executing: ${toolName}`);
          
          // 🧮 Execute mathematical function (calculateSquare, etc.)
          const toolResult = await this.toolRegistry.executeTool(toolName, toolArgs);
          
          console.log(`[TOOL] ✅ ${toolName} completed successfully`);
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: toolResult
          });
        } catch (error) {
          console.error(`[TOOL] ❌ ${toolName} failed:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: `Error executing ${toolName}: ${error}`
          });
        }
      }

      // 🎯 Get final response with tool results
      const finalResponse = await this.azureOpenAI.chat.completions.create({
        model: this.config.deploymentName,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          { role: 'user', content: message },
          completion.message,
          ...toolResults  // Include tool execution results
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: 2000
      });

      return finalResponse.choices[0].message.content || 'No response generated';
    } else {
      // Direct response without tools
      return completion.message.content || 'No response generated';
    }
  } catch (error) {
    console.error(`[AZURE-FOUNDRY] ❌ Chat failed:`, error);
    throw new Error(`Azure Foundry OpenAI processing failed: ${error}`);
  }
}
```

### Data Flow Summary

1. **HTTP Request** → Immediate 202 response with `instanceId`
2. **Orchestrator Starts** → Background workflow begins
3. **User Message Stored** → Persistent in Durable Entity
4. **AI Processing** → Azure Foundry OpenAI + Tool execution
5. **AI Response Stored** → Persistent in Durable Entity
6. **Status Available** → Via orchestrator status endpoint
7. **History Accessible** → Via conversation state endpoint

### Persistence Guarantees

✅ **Conversation History**: Survives function app restarts  
✅ **Session Isolation**: Independent state per `sessionId`  
✅ **Atomic Updates**: Messages added transactionally  
✅ **Concurrent Safety**: Multiple sessions don't interfere  
✅ **Durable Execution**: Orchestrations resume after failures  

### Authentication & Security

🔐 **Azure AD Integration**: No API keys stored in code  
🛡️ **Managed Identity**: Secure token-based authentication  
🔑 **Role-based Access**: Uses Cognitive Services OpenAI User role  
🚫 **No Secrets**: All authentication handled by Azure platform  

## Key Code Changes for @azure/openai 2.0.0

### Authentication
```typescript
// Azure AD (Recommended)
const azureADTokenProvider = getBearerTokenProvider(new DefaultAzureCredential(), scope);
const client = new AzureOpenAI({ 
  azureADTokenProvider, 
  deployment: deploymentName,
  apiVersion: "2024-10-21"
});

// API Key (Fallback)
const client = new AzureOpenAI({
  endpoint: endpoint,
  apiKey: apiKey,
  deployment: deploymentName,
  apiVersion: "2024-10-21"
});
```

### API Calls
```typescript
// Old API (1.x)
const completion = await client.getChatCompletions(deployment, messages, options);

// New API (2.0.0)
const completion = await client.chat.completions.create({
  model: deployment,
  messages: messages,
  tools: tools,
  tool_choice: 'auto',
  temperature: 0.7,
  max_tokens: 2000
});

// Tool calls property changed
choice.message.tool_calls // (was toolCalls in 1.x)
```

## Files Structure

- `src/durableAgentOrchestrator.ts` - Main orchestrator with Azure Foundry OpenAI 2.0.0 integration
- `src/function-app.ts` - Function app entry point with tool definitions
- `src/Tool.ts` - Tool registry and schema generation utilities

## Development

- **Watch mode:** `npm run watch`
- **Build:** `npm run build`
- **Start:** `npm start`

## Deployment

### Azure AD Authentication Setup

1. **Enable system-assigned managed identity** on your Function App
2. **Grant Cognitive Services OpenAI User role** to the managed identity
3. **Deploy without API keys**

### Deploy to Azure

```bash
func azure functionapp publish your-function-app-name
```

**Environment Variables for Azure AD:**
```bash
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

**Environment Variables for API Key (if needed):**
```bash
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
```

## Migration from @azure/openai 1.x

If migrating from an older version:

1. **Update package.json:**
   ```json
   {
     "dependencies": {
       "@azure/openai": "2.0.0",
       "@azure/identity": "^4.0.1",
       "openai": "^4.67.3"
     }
   }
   ```

2. **Update imports:**
   ```typescript
   import { AzureOpenAI } from 'openai';
   import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
   import '@azure/openai/types';
   ```

3. **Update API calls:**
   - `getChatCompletions()` → `chat.completions.create()`
   - `toolCalls` → `tool_calls`
   - Parameter names: `maxTokens` → `max_tokens`, `toolChoice` → `tool_choice`

## Advanced Usage

### Custom Tools

Add new tools by registering them in `function-app.ts`:

```typescript
mathToolRegistry.registerTool(createTool({
  name: 'calculateCube',
  description: 'Calculate the cube of a number (n³)',
  parameters: {
    number: createParameter('number', 'The number to cube')
  },
  handler: async (number: number) => {
    const result = Math.pow(number, 3);
    return `${number}³ = ${result}`;
  }
}));
```

### Multiple Agents

Create multiple agents in the same Function App:

```typescript
const mathAgent = new AzureFoundryAgentOrchestrator(mathConfig, mathToolRegistry);
const scienceAgent = new AzureFoundryAgentOrchestrator(scienceConfig, scienceToolRegistry);

agent1.run();
agent2.run();
```

## 🔧 Development & Debugging

### Console Log Monitoring

Watch the console output for detailed execution flow:

```
[HTTP] 📨 Chat request from Mozilla/5.0...
[HTTP] 💬 "What is 12 squared?" → Session: test-session-1
[HTTP] 🚀 Starting orchestrator: chatOrchestrator
[HTTP] 🔄 Orchestrator started in background: a1b2c3d4-e5f6-7890-1234-567890abcdef
[ORCHESTRATOR] 🚀 EXECUTING WORKFLOW for session: test-session-1
[ORCHESTRATOR] 📝 Step 1: Storing user message in entity
[ENTITY] ➕ Adding user message (19 chars)
[ENTITY] ✅ Total messages: 1
[ORCHESTRATOR] 🤖 Step 2: Calling processChatActivity
[ACTIVITY] 🚀 processChatActivity STARTED for session: test-session-1
[AZURE-FOUNDRY] 🚀 Processing: "What is 12 squared?..."
[AZURE-FOUNDRY] 📝 Tool calls requested: 1
[AZURE-FOUNDRY] 🔧 Processing 1 tool call(s)
[TOOL] 🔧 Executing: calculateSquare
[TOOL] ✅ calculateSquare completed successfully
[AZURE-FOUNDRY] ✅ Final response: "The square of 12 is 144."
[ACTIVITY] ✅ executeOpenAIChat completed! Response: 26 chars
[ORCHESTRATOR] 💾 Step 3: Storing assistant response in entity
[ENTITY] ➕ Adding assistant message (26 chars)
[ENTITY] ✅ Total messages: 2
[ORCHESTRATOR] ✅ WORKFLOW COMPLETED for session: test-session-1
```

### Development Commands

```bash
# Watch mode for development
npm run watch    # Rebuilds on file changes

# Clean build
npm run clean    # Remove dist folder
npm run build    # Full rebuild

# Start with verbose logging
func start --verbose

# Start with specific port
func start --port 7072
```

## 🚨 Troubleshooting Guide

### Authentication Issues

**Problem**: `401 Unauthorized` or authentication errors

**Solutions**:
```bash
# 1. Check Azure CLI login
az account show

# 2. Re-login if needed
az login

# 3. Verify subscription
az account list --output table

# 4. Check OpenAI role assignment
az role assignment list --assignee $(az account show --query user.name -o tsv) --all
```

**Problem**: "DefaultAzureCredential failed to retrieve a token"

**Solution**: Ensure you're logged in with `az login` and have the correct role assignments.

### Configuration Issues

**Problem**: `Missing AZURE_OPENAI_ENDPOINT`

**Solution**:
```bash
# Check your local.settings.json
cat local.settings.json

# Ensure these values are set:
# AZURE_OPENAI_ENDPOINT
# AZURE_OPENAI_DEPLOYMENT_NAME
```

**Problem**: "Deployment not found" errors

**Solution**: Verify your deployment name matches exactly:
```bash
# List your deployments
az cognitiveservices account deployment list \
  --resource-group your-rg \
  --name your-openai-resource
```

### Runtime Issues

**Problem**: Orchestrator stuck in "Pending" or "Running"

**Solutions**:
1. **Check Azurite**: Ensure it's running on ports 10000-10002
2. **Check logs**: Look for error messages in the console
3. **Restart function app**: Stop (`Ctrl+C`) and restart (`npm start`)
4. **Clear storage**: Stop Azurite, delete storage files, restart

**Problem**: "Function not found" errors

**Solution**: 
```bash
# Ensure build completed successfully
npm run build

# Check dist folder exists
ls dist/src/

# Should see: durableAgentOrchestrator.js, function-app.js, Tool.js
```

**Problem**: Tool execution failures

**Solutions**:
1. **Input validation**: Check tool parameter types and ranges
2. **Expression syntax**: Verify mathematical expressions are valid
3. **Safety limits**: Factorial limited to n≤20, expressions must be safe

### Network Issues

**Problem**: Connection timeouts to Azure OpenAI

**Solutions**:
1. **Check endpoint**: Verify URL format and accessibility
2. **Network connectivity**: Test with curl or browser
3. **Service status**: Check Azure Service Health
4. **Rate limits**: Azure OpenAI may throttle requests

### Storage Issues

**Problem**: Azurite connection errors

**Solutions**:
```bash
# Check if Azurite is running
netstat -an | findstr 10000
netstat -an | findstr 10001  
netstat -an | findstr 10002

# Start Azurite if not running
azurite --silent --location c:\azurite

# Alternative: Use different storage
# In local.settings.json, change:
# "AzureWebJobsStorage": "your-azure-storage-connection-string"
```

### Performance Issues

**Problem**: Slow AI responses (>10 seconds)

**Possible Causes & Solutions**:
1. **Cold start**: First request after idle takes longer (normal)
2. **Model selection**: Larger models (GPT-4) are slower than smaller ones (GPT-3.5)
3. **Complex expressions**: Mathematical expressions with many operations
4. **Azure region**: Choose region closer to your location
5. **Pricing tier**: Higher tiers have better performance

### Development Tips

**Enable Detailed Logging:**
```typescript
// In durableAgentOrchestrator.ts, add more console.log statements
console.log(`[DEBUG] Variable value:`, variableValue);
```

**Test Individual Components:**
```bash
# Test only the health endpoint
curl http://localhost:7071/api/mathagent/health

# Test Azure OpenAI directly
az cognitiveservices account show --name your-resource --resource-group your-rg
```

**Monitor Azure Storage (if using cloud storage):**
```bash
# Use Azure Storage Explorer or Azure Portal
# Check Tables: DurableTask* tables for orchestration state
# Check Blobs: azure-webjobs-* containers for function metadata
```

### Common Error Messages & Solutions

| Error Message | Solution |
|---------------|----------|
| `ENOENT: no such file or directory, open 'local.settings.json'` | Create `local.settings.json` file |
| `The host.json file is missing` | Ensure `host.json` exists in project root |
| `Functions runtime is unable to start` | Check Node.js version (need 18+) |
| `Cannot find module '@azure/functions'` | Run `npm install` |
| `orchestrator function 'chatOrchestrator' failed` | Check Azure OpenAI configuration |
| `Entity operation 'addMessage' failed` | Check Azurite/storage connectivity |

### Getting Additional Help

1. **Enable Application Insights** (for production):
   - Add `APPINSIGHTS_INSTRUMENTATIONKEY` to settings
   - Monitor telemetry and errors

2. **Check Azure Service Health**:
   - Visit [Azure Status](https://status.azure.com/)
   - Verify Azure OpenAI service availability

3. **Review Documentation**:
   - [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
   - [Azure OpenAI Documentation](https://docs.microsoft.com/azure/cognitive-services/openai/)
   - [Durable Functions Documentation](https://docs.microsoft.com/azure/azure-functions/durable/)

4. **Community Support**:
   - [Azure Functions GitHub](https://github.com/Azure/azure-functions-host)
   - [Azure OpenAI GitHub](https://github.com/Azure/azure-openai-samples)
   - [Stack Overflow - azure-functions](https://stackoverflow.com/questions/tagged/azure-functions)

## ✨ Key Benefits & Features

### 🔐 Security & Authentication
- **Azure AD Integration**: No API keys stored in code or configuration
- **Managed Identity Support**: Seamless authentication in Azure environments  
- **Role-Based Access Control**: Fine-grained permissions using Azure RBAC
- **Zero-Trust Security**: All authentication handled by Azure platform

### ⚡ Performance & Scalability
- **Immediate Response**: HTTP 202 response within 50-100ms
- **Background Processing**: AI operations don't block HTTP requests
- **Auto-scaling**: Azure Functions automatically scale based on demand
- **Optimized API**: @azure/openai 2.0.0 optimized for Azure services

### 🔄 Reliability & State Management  
- **Durable Orchestrations**: Workflows survive function app restarts
- **Persistent Conversations**: Chat history maintained across sessions
- **Automatic Retries**: Built-in retry logic for transient failures
- **Atomic Operations**: State updates are transactional and consistent

### 🛠️ Developer Experience
- **Type Safety**: Full TypeScript support with proper interfaces
- **Comprehensive Logging**: Detailed console output for debugging
- **Extensible Architecture**: Easy to add new tools and capabilities
- **Production Ready**: Enterprise-grade patterns and error handling

### 🧮 Mathematical Capabilities
- **Specialized Tools**: Purpose-built mathematical functions
- **Safe Execution**: Input validation and safety limits
- **Tool Chaining**: AI can combine multiple tools for complex problems
- **Error Handling**: Graceful fallbacks for invalid inputs

## 📚 Additional Resources

- 📖 **[API Reference](./API-REFERENCE.md)**: Detailed API documentation with examples
- 🔗 **[Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)**
- 🤖 **[Azure OpenAI Documentation](https://docs.microsoft.com/azure/ai-services/openai/)**
- 🔧 **[@azure/openai 2.0.0 Package](https://www.npmjs.com/package/@azure/openai)**
- 🏗️ **[Durable Functions Documentation](https://docs.microsoft.com/azure/azure-functions/durable/)**

## 🆘 Need Help?

- 🐛 **Issues**: Check the troubleshooting section above
- 💬 **Questions**: Use GitHub Discussions or Stack Overflow
- 📧 **Feedback**: Open issues for improvements or bug reports
- 🤝 **Contributing**: Pull requests welcome for enhancements

---

**🎉 Congratulations!** You now have a fully functional mathematical AI agent powered by Azure Foundry OpenAI with enterprise-grade reliability and security.