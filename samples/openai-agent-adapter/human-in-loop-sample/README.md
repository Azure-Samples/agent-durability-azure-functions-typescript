# Human-in-the-Loop Financial Agent with Azure Functions

This sample demonstrates how to build a **responsible AI agent** that requires human approval for sensitive financial operations using Azure Durable Functions and OpenAI. The system ensures critical operations like money transfers receive human oversight before execution, while allowing safe operations like balance checks to execute immediately.

## 🎯 What This Sample Demonstrates

- **Single Financial AI Agent** with human oversight for payments
- **Selective Human Approval** - only payment operations require approval
- **Persistent Approval State** using Azure Durable Entities  
- **Structured Approval Workflow** with detailed reasoning and audit trails
- **Production-Ready Architecture** with comprehensive error handling and logging

---

## 🛡️ Human-in-the-Loop Architecture Explained

### The Challenge

Modern AI agents can perform powerful operations, but some actions are too risky to execute without human oversight:

- **Financial Operations**: Transferring money, making payments
- **Data Operations**: Deleting files, dropping databases  
- **Communication**: Sending emails, external notifications
- **System Operations**: Deployments, configuration changes

### The Solution: Selective Human Approval

This implementation uses a **hybrid approach** where:

1. **Safe Operations** execute immediately (checking balances, reading files, drafting emails)
2. **Risky Operations** pause for human approval before execution
3. **AI Intelligence** determines which tools to use based on natural language
4. **Durable State** ensures approval workflows survive system restarts

### 🔄 How Human Approval Works

#### Phase 1: AI Processing & Tool Selection
```typescript
User: "Transfer $5000 from account 12345 to account 67890"
  ↓
AI Analyzes Request → Selects makePayment Tool → Checks Approval Registry
  ↓
makePayment is marked as requiring approval → Create Approval Request
```

#### Phase 2: Human Decision Making
```typescript
Approval Request Created:
{
  "id": "approval-xyz-123",
  "toolName": "makePayment", 
  "toolArgs": { "fromAccount": "12345", "toAccount": "67890", "amount": 5000 },
  "reasoning": "User requested transfer of $5000 between accounts",
  "status": "pending"
}
  ↓
Human Reviews via API/UI → Makes Decision → Submits Approval/Rejection
```

#### Phase 3: Execution Based on Decision  
```typescript
if (approved) {
  Execute makePayment(12345, 67890, 5000) → "Payment completed. TXN-ID: xxx"
} else {
  Skip execution → "Payment rejected by human reviewer: [reason]"  
}
  ↓
AI generates final response including approval outcome
```

## 💰 Financial Agent Overview

**Purpose**: Handles banking and financial operations with strict security for payment operations
**Risk Level**: High for payments, Low for inquiries and reports

**Tools Available**:
- `checkAccountBalance` - Check account balance (✅ **Safe** - No approval needed)
- `generateReport` - Create financial reports (✅ **Safe** - No approval needed)
- `makePayment` - Transfer money between accounts (⚠️ **Requires Human Approval**)

**Example Interactions**:

**Safe Operations (Immediate Execution):**
```
User: "What's my balance for account 12345?"
→ Executes immediately: "Account 12345 balance: $15,250"

User: "Generate a report for account 12345 for last month"
→ Executes immediately: "Financial report for account 12345 (last month): Generated successfully..."
```

**Risky Operations (Human Approval Required):**
```
User: "Transfer $5000 from account 12345 to account 67890"  
→ Creates approval request → Waits for human decision → Executes if approved

User: "Pay $2500 from my checking to savings account"
→ Creates approval request → Waits for human decision → Executes if approved
```

---

## 🏗️ System Architecture

### High-Level Flow Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Request  │───▶│   AI Agent       │───▶│  Tool Registry  │
│ "Transfer $5000"│    │ (OpenAI GPT-4o)  │    │ (Function Defs) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Human Approval  │◀───│ Approval Check   │───▶│ Tool Execution  │
│    Required?    │    │ (Security Layer) │    │ (If Approved)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                     │                        │
         ▼                     ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Execute Safely  │    │ Wait for Human   │    │ Final Response  │
│ (No Approval)   │    │    Decision      │    │  with Result    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Detailed Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Functions App                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Financial Agent │  │   Data Agent    │  │ Communication   │  │
│  │                 │  │                 │  │     Agent       │  │
│  │ • makePayment*  │  │ • deleteFile*   │  │ • sendEmail*    │  │
│  │ • checkBalance  │  │ • listFiles     │  │ • draftEmail    │  │
│  │ • generateRpt   │  │ • readFile      │  │ • scheduleMsg   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                    │                    │           │
├───────────┼────────────────────┼────────────────────┼───────────┤
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │          HumanInLoopDurableAgentWrapper                     ││
│  │                                                             ││
│  │  ┌─────────────────┐    ┌─────────────────────────────────┐ ││
│  │  │ Conversation    │    │        Approval Engine          │ ││
│  │  │ Entity          │    │                                 │ ││
│  │  │ - Chat History  │    │ • Approval Registry             │ ││
│  │  │ - Pending       │    │ • Risk Assessment               │ ││
│  │  │   Approvals     │    │ • Human Decision Handling       │ ││
│  │  │ - Audit Trail   │    │ • Tool Execution Gating         │ ││
│  │  └─────────────────┘    └─────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                        Durable Functions                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Chat            │  │ Conversation    │  │ Process Chat    │  │
│  │ Orchestrator    │  │ Entity          │  │ Activity        │  │
│  │                 │  │ (State Store)   │  │ (OpenAI + Tools)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Systems                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ OpenAI GPT-4o   │  │ Azure Storage   │  │ Human Approval  │  │
│  │ • Function Call │  │ • Durable State │  │ • API Endpoints │  │
│  │ • Tool Selection│  │ • Conversation  │  │ • Web Interface │  │
│  │ • Natural Lang. │  │ • Approvals     │  │ • Notifications │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

* = Requires Human Approval
```

### 🔄 Approval Workflow Sequence

```
1. User Request
   │
   ├─ "Check balance for account 12345"
   │   │
   │   ▼ (Safe Operation)
   │   └─ Execute checkAccountBalance() → Response
   │
   └─ "Transfer $5000 from 12345 to 67890"
       │
       ▼ (Risky Operation)
       ├─ Create Approval Request
       │   ├─ ID: approval-xyz-123
       │   ├─ Tool: makePayment
       │   ├─ Args: {from: 12345, to: 67890, amount: 5000}
       │   └─ Reasoning: "User requested money transfer"
       │
       ├─ Store in Durable Entity
       │   └─ Status: "pending"
       │
       ├─ Return to User:
       │   └─ "Approval required. Check /approvals/session-id"
       │
       ├─ Human Reviews:
       │   ├─ GET /approvals/session-id (see pending)
       │   └─ POST /approvals/session-id (approve/reject)
       │
       ├─ If Approved:
       │   ├─ Execute makePayment(12345, 67890, 5000)
       │   ├─ Result: "Payment completed. TXN-456789"
       │   └─ Update conversation state
       │
       └─ If Rejected:
           ├─ Skip tool execution
           ├─ Result: "[REJECTED] Human denied payment"
           └─ Update conversation state
```

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
🚀 Initializing Human-in-the-Loop Financial Agent System...
✅ Human-in-the-Loop Financial Agent System Ready!
📍 Available Endpoints:
💰 Financial Agent: /api/financialagent/chat/{sessionId}
🔐 Human Approval Required For:
   💰 Financial: makePayment
✅ Safe Operations (No Approval):
   � Financial: checkAccountBalance, generateReport
```

---

## 🧪 Testing the System

### Test 1: Safe Operations (No Approval Needed)

These operations execute immediately without human approval:

**Financial Agent - Check Balance:**
```http
POST http://localhost:7071/api/financialagent/chat/safe-demo
Content-Type: application/json

{
  "message": "What is my balance for account 12345?",
  "sessionId": "safe-demo"
}
```

**Expected Response (Immediate):**
```json
{
  "success": true,
  "message": "Chat processing started",
  "sessionId": "safe-demo",
  "instanceId": "orchestrator-guid",
  "stateEndpoint": "/api/financialagent/state/safe-demo",
  "approvalEndpoint": "/api/financialagent/approvals/safe-demo"
}
```

**Get the Result:**
```http
GET http://localhost:7071/api/financialagent/state/safe-demo
```

**Expected State Response:**
```json
{
  "success": true,
  "sessionId": "safe-demo",
  "messageCount": 2,
  "pendingApprovalCount": 0,
  "recentMessages": [
    {
      "role": "user",
      "content": "What is my balance for account 12345?",
      "timestamp": "2025-11-17T10:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "Account 12345 balance: $24,750",
      "timestamp": "2025-11-17T10:00:02Z"
    }
  ],
  "pendingApprovals": []
}
```

### Test 2: Operations Requiring Approval  

These operations create approval requests and wait for human decisions:

**Financial Agent - Make Payment (Requires Approval):**
```http
POST http://localhost:7071/api/financialagent/chat/payment-demo
Content-Type: application/json

{
  "message": "Transfer $5000 from account 12345 to account 67890",
  "sessionId": "payment-demo"
}
```

**Check for Pending Approval:**
```http
GET http://localhost:7071/api/financialagent/approvals/payment-demo
```

**Expected Approval Response:**
```json
{
  "success": true,
  "sessionId": "payment-demo", 
  "approvals": [
    {
      "id": "approval-payment-demo-makePayment-1668700000000",
      "toolName": "makePayment",
      "toolArgs": {
        "fromAccount": "12345",
        "toAccount": "67890", 
        "amount": 5000
      },
      "reasoning": "User requested transfer of $5000",
      "timestamp": "2025-11-17T10:00:00Z",
      "status": "pending"
    }
  ]
}
```

### Test 3: Handle Human Approvals

**Approve the Payment:**
```http
POST http://localhost:7071/api/financialagent/approvals/payment-demo
Content-Type: application/json

{
  "approvalId": "approval-payment-demo-makePayment-1668700000000",
  "decision": "approved",
  "humanResponse": "Verified with finance team - payment approved"
}
```

**Expected Approval Response:**
```json
{
  "success": true,
  "message": "Approval approved",
  "sessionId": "payment-demo",
  "approvalId": "approval-payment-demo-makePayment-1668700000000", 
  "decision": "approved"
}
```

**Check Updated Conversation State:**
```http
GET http://localhost:7071/api/financialagent/state/payment-demo
```

**Expected Final State:**
```json
{
  "success": true,
  "sessionId": "payment-demo",
  "messageCount": 2,
  "pendingApprovalCount": 0,
  "recentMessages": [
    {
      "role": "user",
      "content": "Transfer $5000 from account 12345 to account 67890",
      "timestamp": "2025-11-17T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "[HUMAN APPROVED] Payment of $5000 from 12345 to 67890 completed. Transaction ID: TXN-1668700003456",
      "timestamp": "2025-11-17T10:00:15Z"
    }
  ],
  "pendingApprovals": [],
  "approvalHistory": [
    {
      "id": "approval-payment-demo-makePayment-1668700000000",
      "toolName": "makePayment",
      "status": "approved",
      "humanResponse": "Verified with finance team - payment approved",
      "humanResponseTimestamp": "2025-11-17T10:00:10Z"
    }
  ]
}
```
