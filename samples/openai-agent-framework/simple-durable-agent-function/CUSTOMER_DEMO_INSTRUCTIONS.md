# 🚀 Simple Agent App Local - Demo Instructions

This guide provides step-by-step instructions for customers to run the **Simple Agent App Local** demo, which showcases an AI-powered math agent using Azure Functions and OpenAI integration.

## 📋 Prerequisites

Before running the demo, ensure you have the following installed on your system:

### Required Software
1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **Azure Functions Core Tools**
   - Install globally: `npm install -g azure-functions-core-tools@4 --unsafe-perm true`
   - Verify installation: `func --version`

3. **TypeScript** (recommended)
   - Install globally: `npm install -g typescript`
   - Verify installation: `tsc --version`

### Required Accounts
1. **OpenAI API Key**
   - Sign up at: https://platform.openai.com/
   - Create an API key in your OpenAI dashboard
   - Ensure you have sufficient credits/quota

## 🔧 Setup Instructions

### Step 1: Navigate to Project Directory
```powershell
cd "c:\path\to\agent-durability-azure-functions-typescript\samples\openai-agent-framework\simple-agent-app-local"
```

### Step 2: Install Dependencies
```powershell
npm install
```

This will install all required packages including:
- Azure Functions runtime
- OpenAI SDK
- TypeScript compiler
- Durable Functions

### Step 3: Configure OpenAI API Key

1. Open the `local.settings.json` file
2. Replace `"your-openai-api-key-here"` with your actual OpenAI API key:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "WEBSITE_NODE_DEFAULT_VERSION": "~18",
    "OPENAI_API_KEY": "sk-your-actual-openai-api-key-here"
  }
}
```

⚠️ **Security Note**: Never commit your API key to source control. Keep `local.settings.json` in your `.gitignore`.

### Step 4: Build the Project
```powershell
npm run build
```

This compiles the TypeScript code to JavaScript in the `dist/` folder.

## 🚀 Running the Demo

### Start the Azure Functions Host
```powershell
npm start
```

**Expected Output:**
```
Azure Functions Core Tools
Core Tools Version: 4.x.x
Function Runtime Version: 4.x.x

Functions:

  entityChat: [POST] http://localhost:7071/api/entity/chat/{agentName}
  entityState: [GET] http://localhost:7071/api/entity/state/{sessionId}
  directChat: [POST] http://localhost:7071/api/direct/chat/{agentName}

For detailed output, run func with --verbose flag.
[2025-11-16T10:30:00.000Z] Host lock lease acquired by instance ID '000000000000000000000000XXXXXXXX'.
[2025-11-16T10:30:00.000Z] Host started
```

The server is now running at `http://localhost:7071`

## 🧪 Testing the Demo

You have several options for testing the demo:

### Option 1: Using VS Code REST Client (Recommended)

1. Install the "REST Client" extension in VS Code
2. Open the `demo.http` file
3. Click "Send Request" above any HTTP request

### Option 2: Using PowerShell (Command Line)

#### Test 1: Calculate Square (Entity Mode - Fire and Forget)
```powershell
$body = @{
    message = "What is the square of 7?"
    session_key = "demo-session-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/entity/chat/MathAgent" `
                  -Method POST `
                  -Body $body `
                  -ContentType "application/json"
```

**Expected Response:**
```json
{
  "architecture": "entity-based",
  "mode": "fire-and-forget",
  "agent": "MathAgent",
  "sessionId": "MathAgent:demo-session-001",
  "success": true,
  "message": "Agent execution signaled successfully. Processing asynchronously in entity.",
  "timestamp": "2025-11-16T10:30:00.000Z"
}
```

#### Test 2: Calculate Factorial (Direct Mode - Synchronous)
```powershell
$body = @{
    message = "Calculate factorial of 5"
    session_key = "direct-session-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/direct/chat/MathAgent" `
                  -Method POST `
                  -Body $body `
                  -ContentType "application/json"
```

**Expected Response:**
```json
{
  "architecture": "direct-execution",
  "mode": "synchronous", 
  "agent": "MathAgent",
  "sessionId": "MathAgent:direct-session-001",
  "success": true,
  "response": "The factorial of 5 is 120",
  "executionTimeMs": 1250
}
```

#### Test 3: Check Agent State
```powershell
Invoke-RestMethod -Uri "http://localhost:7071/api/entity/state/MathAgent:demo-session-001" `
                  -Method GET
```

### Option 3: Using cURL

#### Calculate Square
```bash
curl -X POST http://localhost:7071/api/entity/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the square of 7?",
    "session_key": "demo-session-001"
  }'
```

#### Solve Complex Expression
```bash
curl -X POST http://localhost:7071/api/direct/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the square of 5 plus the factorial of 4?",
    "session_key": "complex-session-001"
  }'
```

## 🔍 Demo Scenarios

### Scenario 1: Basic Math Operations
Test the AI's ability to understand and execute basic math operations:

1. **Square calculation**: "What is the square of 8?"
2. **Factorial calculation**: "Calculate factorial of 6"
3. **Simple equation**: "Solve: 15 + 25 * 2"
4. **Greeting**: "Hello, what can you do?"

### Scenario 2: Complex Multi-Step Reasoning
Test the AI's ability to chain multiple operations:

1. **Combined operations**: "What's the square of 5 plus the factorial of 4?"
2. **Sequential queries**: Send multiple messages in the same session to see conversation history

### Scenario 3: Architecture Comparison
Compare the two execution modes:

1. **Entity Mode** (Fire-and-forget): Returns immediately, processes asynchronously
2. **Direct Mode** (Synchronous): Waits for completion, returns full result

## 📊 Available Tools

The **MathAgent** has access to these tools:

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `calculateSquare` | Calculate the square of a number | "What's the square of 9?" |
| `calculateFactorial` | Calculate factorial of a number | "Calculate factorial of 5" |
| `solveEquation` | Solve mathematical expressions | "Solve: 100 / 5 + 3" |
| `hello` | Returns a greeting message | "hello" or "hi" |

## 🏗️ Architecture Overview

### Two Execution Patterns

#### 1. Entity-Based (Async)
- **Endpoint**: `POST /api/entity/chat/{agentName}`
- **Pattern**: Fire-and-forget
- **Use Case**: Long-running operations, conversation history
- **Response**: Immediate acknowledgment (202 Accepted)

#### 2. Direct Execution (Sync)
- **Endpoint**: `POST /api/direct/chat/{agentName}`
- **Pattern**: Synchronous execution
- **Use Case**: Quick responses, simple operations
- **Response**: Full result after processing (200 OK)

### State Management
- **Endpoint**: `GET /api/entity/state/{sessionId}`
- **Format**: `AgentName:SessionKey`
- **Returns**: Conversation history and metadata

## 🐛 Troubleshooting

### Common Issues and Solutions

#### 1. "func command not found"
**Solution**: Install Azure Functions Core Tools
```powershell
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

#### 2. "OpenAI API key not set"
**Solution**: Check your `local.settings.json` file and ensure the API key is correctly set:
```json
"OPENAI_API_KEY": "sk-your-actual-key-here"
```

#### 3. "Port 7071 already in use"
**Solution**: Kill existing process or use different port:
```powershell
# Kill process on port 7071
netstat -ano | findstr :7071
taskkill /PID <process-id> /F

# Or use different port
func start --port 7072
```

#### 4. Build errors
**Solution**: Clean and rebuild:
```powershell
npm run clean
npm install
npm run build
```

#### 5. "Cannot find module" errors
**Solution**: Delete node_modules and reinstall:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Debug Mode
For detailed logging, start with verbose flag:
```powershell
func start --verbose
```

## 📝 Expected Behavior

### Successful Interaction Flow
1. **Send Request** → Agent receives message
2. **AI Processing** → OpenAI analyzes request and selects appropriate tools
3. **Tool Execution** → Mathematical operations performed
4. **Response Generation** → AI formats the result
5. **Return Result** → Response sent back to client

### Sample Interaction
```
User: "What's the square of 5 plus the factorial of 4?"

AI Process:
1. Identifies two operations needed
2. Calls calculateSquare(5) → Returns 25
3. Calls calculateFactorial(4) → Returns 24  
4. Calculates: 25 + 24 = 49
5. Responds: "The square of 5 is 25, and the factorial of 4 is 24. So 25 + 24 = 49."
```

## 🔒 Security Notes

1. **API Key Protection**: Never expose your OpenAI API key in public repositories
2. **Local Development Only**: This setup is for local development and testing
3. **Production Considerations**: For production deployment, use Azure Key Vault or similar secure storage

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all prerequisites are installed correctly
3. Ensure your OpenAI API key is valid and has sufficient quota
4. Check the Azure Functions logs for detailed error information

## 🎯 Next Steps

After successfully running this demo:
1. Explore the source code in `src/function-app-simplified.ts`
2. Try creating your own agents with different tools
3. Experiment with different OpenAI models and parameters
4. Consider deploying to Azure for production use

---

**Happy Demo-ing! 🚀**

For more advanced scenarios, check out the `multi-agent-wrapper-sample` for complex agent orchestration patterns.