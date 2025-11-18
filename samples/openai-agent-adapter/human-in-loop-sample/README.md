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

### 🏗️ Technical Implementation

#### 1. Enhanced Durable Wrapper (`HumanInLoopDurableAgentWrapper`)

The core system extends the basic durable wrapper with approval capabilities:

```typescript
export class HumanInLoopDurableAgentWrapper {
  private humanApprovalTools: Set<string> = new Set();
  
  // Configure which tools require approval
  setHumanApprovalTools(toolNames: string[]): void {
    this.humanApprovalTools = new Set(toolNames);
  }
  
  // Check if tool needs approval during execution
  private async executeOpenAIChatWithHumanApproval(message: string, sessionId: string) {
    // ... OpenAI processes request and identifies tools to call
    
    for (const toolCall of completion.message.tool_calls) {
      const toolName = toolCall.function.name;
      
      if (this.humanApprovalTools.has(toolName)) {
        // PAUSE: Create approval request and wait
        const approvalResult = await this.requestHumanApproval(sessionId, toolName, toolArgs);
        
        if (approvalResult.decision === 'approved') {
          // Execute the approved tool
          const toolResult = await this.toolRegistry.executeTool(toolName, toolArgs);
        } else {
          // Skip execution, include rejection reason
          const toolResult = `[HUMAN REJECTED] ${approvalResult.humanResponse}`;
        }
      } else {
        // Execute immediately (safe operation)
        const toolResult = await this.toolRegistry.executeTool(toolName, toolArgs);
      }
    }
  }
}
```

#### 2. Enhanced Conversation State with Approvals

```typescript
export interface ConversationState {
  chatHistory: ChatMessage[];
  pendingApprovals: HumanApprovalRequest[];  // NEW: Track approvals
  createdAt: string;
  lastUpdated: string;
}

export interface HumanApprovalRequest {
  id: string;                    // Unique approval identifier
  toolName: string;             // Tool requiring approval
  toolArgs: any;                // Arguments for the tool
  reasoning: string;            // AI's reasoning for the operation  
  timestamp: string;            // When approval was requested
  status: 'pending' | 'approved' | 'rejected';
  humanResponse?: string;       // Human's decision reasoning
  humanResponseTimestamp?: string;
}
```

#### 3. Specialized Agents with Different Risk Profiles

**Financial Agent** - High-security requirements:
```typescript
const financialAgent = new HumanInLoopDurableAgentWrapper(apiKey, {
  name: 'FinancialAgent',
  model: 'gpt-4o-mini',
  temperature: 0.3,  // Low creativity for precision
  systemPrompt: 'You are a financial assistant. MUST use tools for all operations.'
}, financialToolRegistry);

// Only risky operations need approval
financialAgent.setHumanApprovalTools(['makePayment']);

// Available tools:
// - checkAccountBalance (safe, no approval)
// - generateReport (safe, no approval)  
// - makePayment (risky, requires approval)
```

**Data Agent** - Extreme caution for deletions:
```typescript
const dataAgent = new HumanInLoopDurableAgentWrapper(apiKey, {
  name: 'DataAgent', 
  temperature: 0.2,  // Very low creativity for accuracy
  systemPrompt: 'Data management assistant. Always explain deletion risks.'
}, dataToolRegistry);

// Multiple approval-required operations
dataAgent.setHumanApprovalTools(['deleteFile', 'deleteDatabase']);

// Available tools:
// - listFiles (safe, no approval)
// - readFile (safe, no approval)
// - deleteFile (risky, requires approval)
// - deleteDatabase (extremely risky, requires approval)
```

**Communication Agent** - Balanced approach:
```typescript
const communicationAgent = new HumanInLoopDurableAgentWrapper(apiKey, {
  name: 'CommunicationAgent',
  temperature: 0.4,  // Moderate creativity for communication
  systemPrompt: 'Communication assistant for emails and messages.'
}, communicationToolRegistry);

// Only sending operations need approval
communicationAgent.setHumanApprovalTools(['sendEmail']);

// Available tools:
// - draftEmail (safe, no approval)
// - scheduleMessage (safe, no approval)
// - sendEmail (risky, requires approval)
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

## � Key Features

### 🎯 Intelligent Tool Selection
- **Natural Language Processing**: AI understands user intent and selects appropriate tools
- **Context Awareness**: AI considers conversation history when choosing actions
- **Multi-step Reasoning**: Can chain multiple tools together for complex requests
- **Parameter Extraction**: Automatically extracts tool parameters from natural language

### 🛡️ Selective Human Approval
- **Risk-Based Decisions**: Only dangerous operations require approval
- **Configurable Security**: Each agent can define its own approval requirements
- **Immediate Safe Operations**: Non-risky operations execute without delay
- **Detailed Reasoning**: AI provides context for why approval is needed

### 📋 Comprehensive Approval Workflow
- **Structured Requests**: Approval requests include tool name, arguments, and reasoning
- **Unique Identifiers**: Each approval gets a unique ID for tracking
- **Status Management**: Track pending, approved, and rejected operations
- **Human Feedback**: Capture detailed reasons for approval/rejection decisions

### � Enhanced State Management
- **Conversation History**: Full chat history preserved across sessions
- **Approval History**: Complete audit trail of all approval decisions  
- **Pending Operations**: Real-time view of operations awaiting approval
- **Durable Persistence**: State survives system restarts and scaling events

### 📊 Advanced Monitoring & Auditing
- **Multi-Agent Dashboard**: View approvals across all agents
- **Approval Analytics**: Track approval patterns and response times
- **Security Audits**: Complete log of who approved what and when
- **Compliance Reporting**: Generate reports for regulatory requirements

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
│                     Azure Functions App                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Financial Agent │  │   Data Agent    │  │ Communication   │  │
│  │                 │  │                 │  │     Agent       │  │
│  │ • makePayment*  │  │ • deleteFile*   │  │ • sendEmail*    │  │
│  │ • checkBalance  │  │ • listFiles     │  │ • draftEmail    │  │
│  │ • generateRpt   │  │ • readFile      │  │ • scheduleMsg   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                    │                    │            │
├───────────┼────────────────────┼────────────────────┼────────────┤
│           ▼                    ▼                    ▼            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │          HumanInLoopDurableAgentWrapper                     │  │
│  │                                                             │  │
│  │  ┌─────────────────┐    ┌─────────────────────────────────┐ │  │
│  │  │ Conversation    │    │        Approval Engine          │ │  │
│  │  │ Entity          │    │                                 │ │  │
│  │  │ - Chat History  │    │ • Approval Registry            │ │  │
│  │  │ - Pending       │    │ • Risk Assessment              │ │  │
│  │  │   Approvals     │    │ • Human Decision Handling      │ │  │
│  │  │ - Audit Trail   │    │ • Tool Execution Gating        │ │  │
│  │  └─────────────────┘    └─────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        Durable Functions                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Chat            │  │ Conversation    │  │ Process Chat    │  │
│  │ Orchestrator    │  │ Entity          │  │ Activity        │  │
│  │                 │  │ (State Store)   │  │ (OpenAI + Tools)│  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Systems                          │
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

### Test 4: 🆕 External Event-Based Approval Workflow 

**NEW: Enhanced Real-Time Approval System with External Events**

This is the **recommended approach** for production systems as it provides:
- **Real-time approval workflow** with external event support
- **Timeout handling** for approvals that take too long  
- **Instance-based approval** for better tracking and management
- **Built-in orchestration status** for monitoring workflow progress

#### Step 1: Start Payment with Approval Workflow

**Financial Agent - Payment with External Event Support:**
```http
POST http://localhost:7071/api/financialagent/chat/payment-realtime
Content-Type: application/json

{
  "message": "Transfer $5000 from account 12345 to account 67890",
  "sessionId": "payment-realtime",
  "approvalTimeoutMinutes": 30,
  "maxRetryAttempts": 3
}
```

**Enhanced Response with Instance ID:**
```json
{
  "success": true,
  "message": "Human-in-loop chat processing started. Use instanceId for approval workflow.",
  "sessionId": "payment-realtime", 
  "instanceId": "abc123def456ghi789",
  "stateEndpoint": "/api/financialagent/state/payment-realtime",
  "approvalEndpoint": "/api/financialagent/approvals/payment-realtime",
  "approveByInstanceEndpoint": "/api/financialagent/approve/abc123def456ghi789",
  "statusEndpoint": "/api/financialagent/status/abc123def456ghi789",
  "approvalTimeoutMinutes": 30,
  "maxRetryAttempts": 3
}
```

#### Step 2: Monitor Orchestration Status

**Check Real-Time Workflow Status:**
```http
GET http://localhost:7071/api/financialagent/status/abc123def456ghi789
```

**Status Response - Waiting for Approval:**
```json
{
  "success": true,
  "instanceId": "abc123def456ghi789",
  "runtimeStatus": "Running",
  "workflowStatus": "Requesting human approval for makePayment. Timeout: 30 minutes.",
  "input": {
    "message": "Transfer $5000 from account 12345 to account 67890",
    "sessionId": "payment-realtime",
    "approvalTimeoutMinutes": 30
  },
  "createdTime": "2025-11-17T10:00:00Z",
  "lastUpdatedTime": "2025-11-17T10:00:05Z"
}
```

#### Step 3: Provide Human Decision via External Event

**Approve Payment using Instance ID (RECOMMENDED):**
```http
POST http://localhost:7071/api/financialagent/approve/abc123def456ghi789
Content-Type: application/json

{
  "approved": true,
  "feedback": "Emergency payment verified with CFO - approved for immediate transfer"
}
```

**Approval Event Response:**
```json
{
  "success": true,
  "message": "Human approval sent to orchestration.",
  "instanceId": "abc123def456ghi789",
  "approved": true,
  "feedback": "Emergency payment verified with CFO - approved for immediate transfer"
}
```

#### Step 4: Verify Workflow Completion

**Check Final Status:**
```http
GET http://localhost:7071/api/financialagent/status/abc123def456ghi789
```

**Completed Status Response:**
```json
{
  "success": true,
  "instanceId": "abc123def456ghi789", 
  "runtimeStatus": "Completed",
  "workflowStatus": "Chat workflow completed successfully at 2025-11-17T10:00:25Z",
  "output": {
    "success": true,
    "response": "[HUMAN APPROVED] Payment of $5000 from 12345 to 67890 completed. Transaction ID: TXN-1668700025789"
  },
  "createdTime": "2025-11-17T10:00:00Z",
  "lastUpdatedTime": "2025-11-17T10:00:25Z"
}
```

#### Timeout Scenario

**What happens if no approval is received within 30 minutes:**

**Status Response After Timeout:**
```json
{
  "success": true,
  "instanceId": "abc123def456ghi789",
  "runtimeStatus": "Completed", 
  "workflowStatus": "Human approval timed out for makePayment after 30 minutes. Treating as rejection.",
  "output": {
    "success": true,
    "response": "[TIMEOUT] Tool execution timed out waiting for human approval after 30 minutes."
  }
}
```

#### Key Benefits of External Event Workflow:

- **Real-Time Updates**: Get instant status on workflow progress
- **Reliable Timeout Handling**: Automatic rejection after timeout period  
- **Instance-Based Tracking**: Use instanceId for precise workflow management
- **Production Ready**: Built on Azure Durable Functions for reliability
- **Audit Trail**: Complete history of decisions and timing

---

### Test 5: Rejection Example

**Data Agent - Delete File (Reject):**
```http
POST http://localhost:7071/api/dataagent/chat/delete-demo
Content-Type: application/json

{
  "message": "Delete the file /documents/important-report.pdf", 
  "sessionId": "delete-demo"
}
```

**Check Pending Approval:**
```http
GET http://localhost:7071/api/dataagent/approvals/delete-demo
```

**Reject the Operation:**
```http
POST http://localhost:7071/api/dataagent/approvals/delete-demo
Content-Type: application/json

{
  "approvalId": "approval-delete-demo-deleteFile-1668700020000",
  "decision": "rejected", 
  "humanResponse": "File contains important quarterly data - deletion not authorized"
}
```

**Check Final Result:**
```http
GET http://localhost:7071/api/dataagent/state/delete-demo
```

**Expected Response:**
```json
{
  "recentMessages": [
    {
      "role": "user",
      "content": "Delete the file /documents/important-report.pdf"
    },
    {
      "role": "assistant",
      "content": "[HUMAN REJECTED] File deletion was rejected by human reviewer. Reason: File contains important quarterly data - deletion not authorized"
    }
  ]
}
```

---

## 📡 API Endpoints Reference

> **📋 Important Note about Stateless Endpoints**  
> All chat endpoints (`/api/{agent}/chat/{sessionId}`) are **stateless** and return immediately with processing confirmation. The actual AI response with approval handling is generated asynchronously. Use the state endpoint to retrieve conversation results and approval status.

### 💰 Financial Agent Endpoints

**Chat (Stateless):**
- **POST** `/api/financialagent/chat/{sessionId?}` - Send message to financial agent
- Returns immediately with processing confirmation

**State Management:**
- **GET** `/api/financialagent/state/{sessionId}` - Get conversation history and status  
- **GET** `/api/financialagent/approvals/{sessionId}` - Get pending approvals for session
- **POST** `/api/financialagent/approvals/{sessionId}` - Approve/reject pending operations

**🆕 External Event-Based Approval (RECOMMENDED):**
- **POST** `/api/financialagent/approve/{instanceId}` - Raise approval event to orchestration
- **GET** `/api/financialagent/status/{instanceId}` - Get real-time orchestration status

**Health & Monitoring:**
- **GET** `/api/financialagent/health` - Agent health check and configuration

**Tools Available:**
- `checkAccountBalance` (✅ Safe) - Check account balance 
- `generateReport` (✅ Safe) - Generate financial reports
- `makePayment` (⚠️ **Requires Approval**) - Transfer money between accounts

### � Financial Agent Usage Patterns

**🆕 External Event-Based Workflow (RECOMMENDED):**
1. **Send Message**: POST to `/api/financialagent/chat/{sessionId}` (returns instanceId)
2. **Monitor Status**: GET from `/api/financialagent/status/{instanceId}` (real-time workflow status)
3. **Make Decision**: POST to `/api/financialagent/approve/{instanceId}` (send external event)
4. **Verify Completion**: GET from `/api/financialagent/status/{instanceId}` (final result)

**Session-Based Workflow (LEGACY):**
1. **Send Message**: POST to `/api/financialagent/chat/{sessionId}` (returns immediately)
2. **Check for Approvals**: GET from `/api/financialagent/approvals/{sessionId}` (if payment operation needs approval)
3. **Make Decision**: POST to `/api/financialagent/approvals/{sessionId}` (approve/reject)
4. **Get Final Result**: GET from `/api/financialagent/state/{sessionId}` (contains final AI response)

## Human Approval Configuration

### Tools Requiring Approval

**Financial Agent:**
- `makePayment` - Money transfers and payments

### Setting Approval Requirements

```typescript
// Configure which tools need human approval for the Financial Agent
financialAgent.setHumanApprovalTools(['makePayment']);
```

## Response Formats

### Chat Response (with Approval Needed)
```json
{
  "success": true,
  "message": "Human-in-loop chat processing started",
  "sessionId": "payment-demo",
  "instanceId": "orchestrator-guid",
  "stateEndpoint": "/api/financialagent/state/payment-demo",
  "approvalEndpoint": "/api/financialagent/approvals/payment-demo",
  "timestamp": "2025-11-14T10:00:00.000Z",
  "processingTimeMs": 150
}
```

### Pending Approvals Response
```json
{
  "success": true,
  "sessionId": "payment-demo",
  "approvals": [
    {
      "id": "approval-guid-123",
      "toolName": "makePayment",
      "toolArgs": {
        "fromAccount": "12345",
        "toAccount": "67890", 
        "amount": 5000
      },
      "reasoning": "User requested transfer of $5000",
      "timestamp": "2025-11-14T10:00:00.000Z",
      "status": "pending"
    }
  ]
}
```

### Enhanced State Response
```json
{
  "success": true,
  "sessionId": "payment-demo",
  "messageCount": 3,
  "pendingApprovalCount": 1,
  "createdAt": "2025-11-14T09:00:00.000Z",
  "lastUpdated": "2025-11-14T10:00:00.000Z",
  "recentMessages": [
    {
      "role": "user",
      "content": "Transfer $5000 from account 12345 to 67890",
      "timestamp": "2025-11-14T10:00:00.000Z"
    }
  ],
  "pendingApprovals": [...],
  "approvalHistory": [...]
}
```

## Code Structure

```
src/
├── Tool.ts              # Tool definition and registry wrapper
├── durableWrapper.ts    # Human-in-loop durable functions wrapper
└── function-app.ts      # Financial agent application with approval workflows
```

## Workflow Examples

### 1. Safe Operation Flow
```
User Request → AI Agent → Tool Registry → Execute Tool → Response
```

### 2. Human Approval Flow  
```
User Request → AI Agent → Approval Check → Create Approval Request
      ↓
Wait for Human Decision → Human Approves → Execute Tool → Response
      ↓
Wait for Human Decision → Human Rejects → Skip Tool → Response with Rejection
```

## Integration with External Systems

This sample uses simulated approval logic for demonstration. In production, integrate with:

- **Slack/Teams**: Send approval requests to channels
- **Email**: Email notifications to approvers  
- **Ticketing Systems**: Create approval tickets in JIRA/ServiceNow
- **Mobile Apps**: Push notifications for urgent approvals
- **Web Dashboards**: Real-time approval interfaces

## Security Considerations

- **Authentication**: Add proper auth to approval endpoints in production
- **Authorization**: Implement role-based approval permissions
- **Audit Logging**: Log all approval decisions for compliance
- **Timeout Handling**: Set timeouts for pending approvals
- **Encryption**: Encrypt sensitive data in approval requests

## Best Practices

1. **Clear Tool Descriptions**: Make it obvious why approval is needed
2. **Detailed Reasoning**: Provide context for human decision-making  
3. **Risk Assessment**: Different approval levels for different risks
4. **Timeout Policies**: Handle cases where humans don't respond
5. **Escalation**: Route critical approvals to appropriate authorities
6. **Monitoring**: Track approval response times and patterns

## Extending the Sample

### Adding New Financial Tools
```typescript
financialToolRegistry.registerTool(createTool({
  name: 'createLoan',
  description: 'Create a new loan account (REQUIRES APPROVAL)',
  parameters: { 
    amount: createParameter('number', 'Loan amount'),
    accountNumber: createParameter('string', 'Account number for loan')
  },
  handler: async (amount: number, accountNumber: string) => {
    // Sensitive operation requiring approval
    return `Loan of $${amount} created for account ${accountNumber}`;
  }
}));

// Mark as requiring approval
financialAgent.setHumanApprovalTools(['makePayment', 'createLoan']);
```

This human-in-the-loop Financial Agent sample demonstrates how to build responsible AI systems that maintain human oversight for critical financial operations like payments while still providing the benefits of AI automation for routine tasks like balance checks and report generation.