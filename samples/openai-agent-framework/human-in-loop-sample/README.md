# Human-in-the-Loop AI Agents Sample

This sample demonstrates how to build AI agents that require human approval for sensitive operations using the simplified Tool and DurableWrapper APIs.

## Overview

The Human-in-the-Loop pattern is essential for AI systems that perform sensitive operations where human oversight is critical. This sample includes three agents:

- **💰 Financial Agent**: Handles banking operations (payments require approval)
- **📁 Data Agent**: Manages files and databases (deletions require approval)  
- **📧 Communication Agent**: Drafts and sends emails (sending requires approval)

## Key Features

### 🔐 Human Approval Workflow
- **Automatic Detection**: Agents automatically identify sensitive operations
- **Approval Requests**: Creates structured approval requests for human review
- **Decision Handling**: Processes human approval/rejection decisions
- **Audit Trail**: Maintains complete history of approval decisions

### 🛡️ Safety by Design
- **Configurable Tools**: Specify which tools require human approval
- **Risk Assessment**: Different approval levels for different risk operations
- **Fail-Safe**: Operations are blocked until explicit human approval

### 📊 Enhanced Monitoring
- **Pending Approvals**: Real-time view of operations awaiting approval
- **Approval History**: Complete audit trail of human decisions
- **State Management**: Full conversation and approval context

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Request  │───▶│   AI Agent       │───▶│  Tool Registry  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │                        │
                               ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Human Approval  │◀───│ Approval Check   │───▶│ Tool Execution  │
│    Required?    │    └──────────────────┘    └─────────────────┘
└─────────────────┘            │                        │
         │                     ▼                        ▼
         ▼              ┌──────────────────┐    ┌─────────────────┐
┌─────────────────┐    │ Wait for Human   │    │    Response     │
│ Execute Tool    │    │    Decision      │    │   Generated     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Setup
```bash
# Install dependencies
npm install

# Set your OpenAI API key in local.settings.json
# "OPENAI_API_KEY": "your-actual-api-key"

# Build the project
npm run build

# Start the function app
npm start
```

### 2. Test Safe Operations (No Approval Needed)

**Check Account Balance:**
```bash
POST /api/financialagent/chat
{
  "message": "What is my balance for account 12345?",
  "sessionId": "safe-demo"
}
```

**List Files:**
```bash
POST /api/dataagent/chat
{
  "message": "List files in /documents folder",
  "sessionId": "file-demo"
}
```

### 3. Test Operations Requiring Approval

**Make Payment (Requires Approval):**
```bash
POST /api/financialagent/chat
{
  "message": "Transfer $5000 from account 12345 to account 67890",
  "sessionId": "payment-demo"
}
```

**Delete File (Requires Approval):**
```bash
POST /api/dataagent/chat
{
  "message": "Delete the file /temp/old-data.csv",
  "sessionId": "delete-demo"
}
```

**Send Email (Requires Approval):**
```bash
POST /api/communicationagent/chat
{
  "message": "Send an email to john@company.com about the quarterly report",
  "sessionId": "email-demo"
}
```

### 4. Handle Human Approvals

**Check Pending Approvals:**
```bash
GET /api/financialagent/approvals/payment-demo
```

**Approve Operation:**
```bash
POST /api/financialagent/approvals/payment-demo
{
  "approvalId": "approval-guid-from-pending",
  "decision": "approved",
  "humanResponse": "Verified with finance team - approved"
}
```

**Reject Operation:**
```bash
POST /api/dataagent/approvals/delete-demo
{
  "approvalId": "approval-guid-from-pending", 
  "decision": "rejected",
  "humanResponse": "File still needed - rejection approved"
}
```

## Available Endpoints

### Financial Agent
- **POST** `/api/financialagent/chat/{sessionId?}` - Chat with financial agent
- **GET** `/api/financialagent/state/{sessionId}` - Get conversation and approval state
- **GET** `/api/financialagent/approvals/{sessionId}` - Get pending approvals
- **POST** `/api/financialagent/approvals/{sessionId}` - Handle approval decision
- **GET** `/api/financialagent/health` - Health check

### Data Agent  
- **POST** `/api/dataagent/chat/{sessionId?}` - Chat with data agent
- **GET** `/api/dataagent/state/{sessionId}` - Get conversation and approval state
- **GET** `/api/dataagent/approvals/{sessionId}` - Get pending approvals
- **POST** `/api/dataagent/approvals/{sessionId}` - Handle approval decision
- **GET** `/api/dataagent/health` - Health check

### Communication Agent
- **POST** `/api/communicationagent/chat/{sessionId?}` - Chat with communication agent
- **GET** `/api/communicationagent/state/{sessionId}` - Get conversation and approval state
- **GET** `/api/communicationagent/approvals/{sessionId}` - Get pending approvals
- **POST** `/api/communicationagent/approvals/{sessionId}` - Handle approval decision
- **GET** `/api/communicationagent/health` - Health check

## Human Approval Configuration

### Tools Requiring Approval

**Financial Agent:**
- `makePayment` - Money transfers and payments

**Data Agent:**
- `deleteFile` - File deletion operations
- `deleteDatabase` - Database deletion (extremely dangerous)

**Communication Agent:**
- `sendEmail` - Email sending operations

### Setting Approval Requirements

```typescript
// Configure which tools need human approval
agent.setHumanApprovalTools(['makePayment', 'deleteFile', 'sendEmail']);
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
└── function-app.ts      # Multi-agent application with approval workflows
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

### Adding New Agents
```typescript
const newAgent = new HumanInLoopDurableAgentWrapper(apiKey, config, toolRegistry);
newAgent.setHumanApprovalTools(['sensitiveOperation']);
newAgent.run();
```

### Adding New Approval Tools
```typescript
toolRegistry.registerTool(createTool({
  name: 'criticalOperation',
  description: 'Performs critical system operation (REQUIRES APPROVAL)',
  parameters: { /* ... */ },
  handler: async (...args) => { /* ... */ }
}));
```

This human-in-the-loop sample demonstrates how to build responsible AI systems that maintain human oversight for critical operations while still providing the benefits of AI automation for routine tasks.