# 🚀 Durable Agent HTTP Endpoints - Sample Requests

This document provides sample HTTP requests to test the locally sourced durable agent framework endpoints.

## 📋 Available Endpoints

The sample agent app exposes these HTTP endpoints:

### 1️⃣ Entity-based Execution (Async)
**POST** `/api/entity/chat/{agentName}`
- Fire-and-forget execution
- Returns 202 Accepted immediately  
- Processes asynchronously in background

### 2️⃣ Direct Execution (Sync) 
**POST** `/api/direct/chat/{agentName}`
- Synchronous execution
- Waits for completion
- Returns full response with result

### 3️⃣ Agent State Retrieval
**GET** `/api/entity/state/{sessionId}`
- Get current agent state
- Shows chat history and metadata
- Format: "AgentName:SessionKey"

### 4️⃣ Health Check
**GET** `/api/core/health`
- Returns 404 (endpoint removed)
- Legacy endpoint for compatibility

## 🔧 Available Tools

The **MathAgent** includes these tools:
- `calculateSquare` - Calculate square of number
- `calculateFactorial` - Calculate factorial  
- `solveEquation` - Solve math expressions
- `hello` - Return greeting

## 📝 Sample Requests

### Start the Server
```bash
# In the simple-agent-app-local directory
npm start
```

### Entity-based Execution Examples

#### Calculate Square
```bash
curl -X POST http://localhost:7071/api/entity/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the square of 7?",
    "session_key": "demo-session-001"
  }'
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
  "timestamp": "2025-11-13T19:30:00.000Z",
  "executionPattern": ".NET SignalEntityAsync style"
}
```

#### Calculate Factorial
```bash
curl -X POST http://localhost:7071/api/entity/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Calculate factorial of 5",
    "session_key": "demo-session-002"
  }'
```

#### Solve Expression
```bash
curl -X POST http://localhost:7071/api/entity/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Solve this: 15 + 25 * 2",
    "session_key": "demo-session-003"
  }'
```

#### Hello Tool
```bash
curl -X POST http://localhost:7071/api/entity/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "hello",
    "session_key": "demo-session-004"
  }'
```

### Check Agent State

#### Get State for Session
```bash
curl -X GET http://localhost:7071/api/entity/state/MathAgent:demo-session-001
```

**Expected Response:**
```json
{
  "architecture": "entity-based",
  "sessionId": "MathAgent:demo-session-001", 
  "success": true,
  "state": {
    "messageCount": 2,
    "createdAt": "2025-11-13T19:30:00.000Z",
    "lastUpdated": "2025-11-13T19:30:05.000Z",
    "recentMessages": [
      {
        "role": "user",
        "content": "What is the square of 7?",
        "timestamp": "2025-11-13T19:30:00.000Z"
      },
      {
        "role": "assistant", 
        "content": "The square of 7 is 49",
        "timestamp": "2025-11-13T19:30:05.000Z"
      }
    ]
  }
}
```

### Direct Execution Examples

#### Calculate Square (Synchronous)
```bash
curl -X POST http://localhost:7071/api/direct/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the square of 9?",
    "session_key": "direct-session-001"  
  }'
```

**Expected Response:**
```json
{
  "architecture": "direct-execution",
  "mode": "synchronous",
  "agent": "MathAgent", 
  "sessionId": "MathAgent:direct-session-001",
  "success": true,
  "response": "The square of 9 is 81",
  "executionTimeMs": 15,
  "executionPattern": "Original TypeScript style"
}
```

#### Calculate Factorial (Synchronous)
```bash
curl -X POST http://localhost:7071/api/direct/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Calculate factorial of 6",
    "session_key": "direct-session-002"
  }'
```

#### Solve Expression (Synchronous)
```bash
curl -X POST http://localhost:7071/api/direct/chat/MathAgent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Solve: 100 / 5 + 3", 
    "session_key": "direct-session-003"
  }'
```

### Health Check

```bash
curl -X GET http://localhost:7071/api/core/health
```

**Expected Response:**
```json
{
  "status": "endpoint removed",
  "message": "Core architecture has been removed. Use /api/health-entity instead.",
  "timestamp": "2025-11-13T19:30:00.000Z"
}
```

## 🧪 Testing with PowerShell

### Using Invoke-RestMethod

#### Entity Execution
```powershell
$body = @{
    message = "What is the square of 8?"
    session_key = "ps-session-001"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/entity/chat/MathAgent" `
                  -Method POST `
                  -Body $body `
                  -ContentType "application/json"
```

#### Direct Execution  
```powershell
$body = @{
    message = "Calculate factorial of 4"
    session_key = "ps-session-002"  
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/direct/chat/MathAgent" `
                  -Method POST `
                  -Body $body `
                  -ContentType "application/json"
```

#### Check State
```powershell
Invoke-RestMethod -Uri "http://localhost:7071/api/entity/state/MathAgent:ps-session-001" `
                  -Method GET
```

## 🔗 JavaScript/Fetch Examples

### Entity Execution
```javascript
const response = await fetch('http://localhost:7071/api/entity/chat/MathAgent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "What is the square of 6?",
    session_key: "js-session-001"
  })
});

const result = await response.json();
console.log(result);
```

### Direct Execution
```javascript
const response = await fetch('http://localhost:7071/api/direct/chat/MathAgent', {
  method: 'POST', 
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "Calculate factorial of 7",
    session_key: "js-session-002"
  })
});

const result = await response.json();
console.log(result);
```

## 📊 Response Patterns

### Entity Response (202 Accepted)
```json
{
  "architecture": "entity-based",
  "mode": "fire-and-forget",
  "agent": "MathAgent",
  "sessionId": "MathAgent:session-key",
  "success": true,
  "message": "Agent execution signaled successfully. Processing asynchronously in entity.",
  "timestamp": "2025-11-13T19:30:00.000Z",
  "executionPattern": ".NET SignalEntityAsync style"
}
```

### Direct Response (200 OK)
```json
{
  "architecture": "direct-execution", 
  "mode": "synchronous",
  "agent": "MathAgent",
  "sessionId": "MathAgent:session-key", 
  "success": true,
  "response": "The square of 5 is 25",
  "executionTimeMs": 12,
  "executionPattern": "Original TypeScript style"  
}
```

### State Response (200 OK)
```json
{
  "architecture": "entity-based",
  "sessionId": "MathAgent:session-key",
  "success": true, 
  "state": {
    "messageCount": 4,
    "createdAt": "2025-11-13T19:30:00.000Z",
    "lastUpdated": "2025-11-13T19:35:00.000Z",
    "recentMessages": [...]
  }
}
```

## ✅ Tool Execution Patterns

The locally sourced framework uses **pattern matching** to simulate AI behavior:

- **"square" + number** → `calculateSquare` tool
- **"factorial" + number** → `calculateFactorial` tool  
- **"solve" or math operators** → `solveEquation` tool
- **"hello"** → `hello` tool
- **Default** → Agent instructions

This provides identical functionality to the original sample without requiring OpenAI API calls!