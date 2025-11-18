# 🔢 Azure Foundry OpenAI Math Agent - Setup Guide

This sample demonstrates how to create a **mathematical AI agent** with **Azure Foundry OpenAI services** using the latest **@azure/openai 2.0.0** library and Azure Durable Functions for persistent conversation state management.

## 🎯 What You'll Build

By following this guide, you'll create a math agent that:
- Responds immediately with HTTP 202 (processing started)
- Processes AI requests in the background using Durable Orchestrations
- Maintains conversation history across sessions
- Provides real-time status monitoring
- Supports mathematical computations with specialized tools

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

