/**
 * Human-in-the-Loop Azure Functions App
 * 
 * This example demonstrates AI agents that require human approval for sensitive operations.
 * Scenarios include financial operations, data deletion, email sending, and other high-risk actions.
 */

import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import * as df from 'durable-functions';
import { createTool, createParameter, ToolRegistry } from './Tool';
import { HumanInLoopDurableAgentWrapper } from './durableWrapper';
import { HUMAN_APPROVAL_EVENT } from './orchestration';

// ===== FINANCIAL ASSISTANT AGENT =====

const financialToolRegistry = new ToolRegistry();

financialToolRegistry.registerTool(createTool({
  name: 'checkAccountBalance',
  description: 'Check account balance for a given account number',
  parameters: {
    accountNumber: createParameter('string', 'The account number to check')
  },
  handler: async (accountNumber: string) => {
    // Simulate balance check (safe operation - no human approval needed)
    const balance = Math.floor(Math.random() * 50000) + 1000;
    return `Account ${accountNumber} balance: $${balance.toLocaleString()}`;
  }
}));

financialToolRegistry.registerTool(createTool({
  name: 'makePayment',
  description: 'Transfer money from one account to another (REQUIRES HUMAN APPROVAL)',
  parameters: {
    fromAccount: createParameter('string', 'Source account number'),
    toAccount: createParameter('string', 'Destination account number'),
    amount: createParameter('number', 'Amount to transfer in dollars')
  },
  handler: async (fromAccount: string, toAccount: string, amount: number) => {
    // This is a sensitive operation that will require human approval
    const transactionId = `TXN-${Date.now()}`;
    return `Payment of $${amount} from ${fromAccount} to ${toAccount} completed. Transaction ID: ${transactionId}`;
  }
}));

financialToolRegistry.registerTool(createTool({
  name: 'generateReport',
  description: 'Generate financial report for specified period',
  parameters: {
    accountNumber: createParameter('string', 'Account number for the report'),
    period: createParameter('string', 'Report period (e.g., "last 30 days", "this month")')
  },
  handler: async (accountNumber: string, period: string) => {
    // Safe operation - no approval needed
    return `Financial report for account ${accountNumber} (${period}): Generated successfully. Report includes transactions, fees, and balance changes.`;
  }
}));

const financialAgent = new HumanInLoopDurableAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'FinancialAgent',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    systemPrompt: 'You are a financial assistant that can check balances, make payments, and generate reports. CRITICAL: You MUST ALWAYS use the provided tools to complete user requests - NEVER make up or fabricate responses. When a user requests an action:\n\n- To transfer/pay money: ALWAYS use makePayment tool\n- To check balance: ALWAYS use checkAccountBalance tool  \n- To generate reports: ALWAYS use generateReport tool\n\nYou are FORBIDDEN from providing fake or simulated responses. If a user asks "transfer $5000 from account 12345 to account 67890", you MUST call the makePayment tool with those exact parameters. If they ask for a balance, you MUST call checkAccountBalance. Do not say "I would transfer" or provide example responses - execute the actual tools. This is mandatory for system security and accuracy.'
  },
  financialToolRegistry
);

// Mark payment operations as requiring human approval
financialAgent.setHumanApprovalTools(['makePayment']);

// ===== DATA MANAGEMENT AGENT =====

const dataToolRegistry = new ToolRegistry();

dataToolRegistry.registerTool(createTool({
  name: 'listFiles',
  description: 'List files in a specified directory',
  parameters: {
    directory: createParameter('string', 'Directory path to list files from')
  },
  handler: async (directory: string) => {
    // Safe operation - no approval needed
    const mockFiles = ['document1.pdf', 'data.csv', 'report.xlsx', 'backup.zip'];
    return `Files in ${directory}: ${mockFiles.join(', ')}`;
  }
}));

dataToolRegistry.registerTool(createTool({
  name: 'readFile',
  description: 'Read contents of a specific file',
  parameters: {
    filePath: createParameter('string', 'Full path to the file to read')
  },
  handler: async (filePath: string) => {
    // Safe operation - no approval needed
    return `Contents of ${filePath}: [Sample file content - this would contain the actual file data in a real implementation]`;
  }
}));

dataToolRegistry.registerTool(createTool({
  name: 'deleteFile',
  description: 'Delete a file (REQUIRES HUMAN APPROVAL)',
  parameters: {
    filePath: createParameter('string', 'Full path to the file to delete')
  },
  handler: async (filePath: string) => {
    // Dangerous operation - requires human approval
    return `File ${filePath} has been successfully deleted. This action cannot be undone.`;
  }
}));

dataToolRegistry.registerTool(createTool({
  name: 'deleteDatabase',
  description: 'Delete entire database (REQUIRES HUMAN APPROVAL - EXTREMELY DANGEROUS)',
  parameters: {
    databaseName: createParameter('string', 'Name of the database to delete'),
    confirmationCode: createParameter('string', 'Confirmation code for database deletion')
  },
  handler: async (databaseName: string, confirmationCode: string) => {
    // Extremely dangerous operation - will be rejected by human approval
    return `Database ${databaseName} has been completely deleted. All data is permanently lost.`;
  }
}));

const dataAgent = new HumanInLoopDurableAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'DataAgent',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    systemPrompt: 'You are a data management assistant that can list, read, and manage files and databases. When users ask you to perform actions, you MUST use the available tools to complete their requests. For example, when asked to delete a file, use the deleteFile tool. When asked to list files, use the listFiles tool. Do not just explain what you would do - actually use the tools to perform the requested actions. Be extremely careful with deletion operations and always explain the risks.'
  },
  dataToolRegistry
);

// Mark deletion operations as requiring human approval
dataAgent.setHumanApprovalTools(['deleteFile', 'deleteDatabase']);

// ===== COMMUNICATION AGENT =====

const communicationToolRegistry = new ToolRegistry();

communicationToolRegistry.registerTool(createTool({
  name: 'draftEmail',
  description: 'Draft an email without sending it',
  parameters: {
    recipient: createParameter('string', 'Email recipient'),
    subject: createParameter('string', 'Email subject'),
    content: createParameter('string', 'Email content/body')
  },
  handler: async (recipient: string, subject: string, content: string) => {
    // Safe operation - just drafting
    return `Email drafted:\nTo: ${recipient}\nSubject: ${subject}\nContent: ${content}\n\nStatus: Draft saved (not sent)`;
  }
}));

communicationToolRegistry.registerTool(createTool({
  name: 'sendEmail',
  description: 'Send an email to specified recipient (REQUIRES HUMAN APPROVAL)',
  parameters: {
    recipient: createParameter('string', 'Email recipient'),
    subject: createParameter('string', 'Email subject'),
    content: createParameter('string', 'Email content/body')
  },
  handler: async (recipient: string, subject: string, content: string) => {
    // Sensitive operation - requires approval
    const messageId = `MSG-${Date.now()}`;
    return `Email sent successfully!\nTo: ${recipient}\nSubject: ${subject}\nMessage ID: ${messageId}`;
  }
}));

communicationToolRegistry.registerTool(createTool({
  name: 'scheduleMessage',
  description: 'Schedule a message for later delivery',
  parameters: {
    recipient: createParameter('string', 'Message recipient'),
    content: createParameter('string', 'Message content'),
    scheduleTime: createParameter('string', 'When to send (e.g., "2 hours", "tomorrow 9am")')
  },
  handler: async (recipient: string, content: string, scheduleTime: string) => {
    // Safe operation - just scheduling
    const scheduleId = `SCH-${Date.now()}`;
    return `Message scheduled for ${scheduleTime} to ${recipient}. Schedule ID: ${scheduleId}. Content: "${content}"`;
  }
}));

const communicationAgent = new HumanInLoopDurableAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'CommunicationAgent',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    systemPrompt: 'You are a communication assistant that can draft, send, and schedule emails and messages. When users ask you to perform actions, you MUST use the available tools to complete their requests. For example, when asked to send an email, use the sendEmail tool. When asked to draft an email, use the draftEmail tool. Do not just explain what you would do - actually use the tools to perform the communication tasks. Always review email content carefully and provide clear information about what you are doing.'
  },
  communicationToolRegistry
);

// Mark sending operations as requiring human approval
communicationAgent.setHumanApprovalTools(['sendEmail']);

// ===== INITIALIZE ALL AGENTS =====

console.log('🚀 Initializing Human-in-the-Loop Multi-Agent System...');

// Each agent creates unique durable functions and endpoints with human approval workflows:
// FinancialAgent: Handles payments (with approval), balance checks (no approval)
// DataAgent: Handles file operations, dangerous deletions (with approval)
// CommunicationAgent: Handles email drafting (no approval), sending (with approval)

financialAgent.run();
dataAgent.run();
communicationAgent.run();

console.log('✅ Human-in-the-Loop Multi-Agent System Ready!');
console.log('📍 Available Endpoints:');
console.log('');
console.log('💰 Financial Agent:');
console.log('   💬 Chat: POST /api/financialagent/chat/{sessionId}');
console.log('   📊 State: GET /api/financialagent/state/{sessionId}');
console.log('   👥 Approvals: GET/POST /api/financialagent/approvals/{sessionId}');
console.log('   💚 Health: GET /api/financialagent/health');
console.log('');
console.log('📁 Data Agent:');
console.log('   💬 Chat: POST /api/dataagent/chat/{sessionId}');
console.log('   📊 State: GET /api/dataagent/state/{sessionId}');
console.log('   👥 Approvals: GET/POST /api/dataagent/approvals/{sessionId}');
console.log('   💚 Health: GET /api/dataagent/health');
console.log('');
console.log('📧 Communication Agent:');
console.log('   💬 Chat: POST /api/communicationagent/chat/{sessionId}');
console.log('   📊 State: GET /api/communicationagent/state/{sessionId}');
console.log('   👥 Approvals: GET/POST /api/communicationagent/approvals/{sessionId}');
console.log('   💚 Health: GET /api/communicationagent/health');
console.log('');
console.log('🔐 Human Approval Required For:');
console.log('   💰 Financial: makePayment');
console.log('   📁 Data: deleteFile, deleteDatabase');
console.log('   📧 Communication: sendEmail');

// Example usage scenarios:
console.log('');
console.log('💡 Example Usage:');
console.log('');
console.log('// Safe operation (no approval needed):');
console.log('POST /api/financialagent/chat');
console.log('{ "message": "What is my account balance for account 12345?", "sessionId": "financial-demo" }');
console.log('');
console.log('// Dangerous operation (human approval required):');
console.log('POST /api/financialagent/chat');
console.log('{ "message": "Transfer $5000 from account 12345 to account 67890", "sessionId": "payment-demo" }');
console.log('');

// ===== HUMAN APPROVAL API ENDPOINTS =====

/**
 * Get all pending approvals across all agents
 */
app.http('getPendingApprovals', {
  methods: ['GET'],
  route: 'approvals/pending',
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      // Collect pending approvals from all agents
      const allPendingApprovals = [
        ...financialAgent.getPendingApprovals().map(a => ({...a, agent: 'Financial'})),
        ...dataAgent.getPendingApprovals().map(a => ({...a, agent: 'Data'})),
        ...communicationAgent.getPendingApprovals().map(a => ({...a, agent: 'Communication'}))
      ];
      
      return {
        status: 200,
        jsonBody: {
          count: allPendingApprovals.length,
          approvals: allPendingApprovals
        }
      };
    } catch (error) {
      console.error('Failed to get pending approvals:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to get pending approvals' }
      };
    }
  }
});

/**
 * Process approval decision for a specific approval ID
 */
app.http('processApproval', {
  methods: ['POST'],
  route: 'approval/{approvalId}',
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const approvalId = request.params.approvalId;
      const body = await request.json() as any;
      
      if (!approvalId) {
        return {
          status: 400,
          jsonBody: { error: 'approvalId is required' }
        };
      }
      
      if (typeof body.approved !== 'boolean') {
        return {
          status: 400,
          jsonBody: { error: 'approved field must be true or false' }
        };
      }
      
      console.log(`[APPROVAL] 📋 Processing approval ${approvalId}: ${body.approved ? 'APPROVED' : 'REJECTED'}`);
      
      // Try to process approval with each agent
      let processed = false;
      let agent = '';
      
      if (await financialAgent.processApprovalDecision(approvalId, body.approved, body.feedback)) {
        processed = true;
        agent = 'Financial';
      } else if (await dataAgent.processApprovalDecision(approvalId, body.approved, body.feedback)) {
        processed = true;
        agent = 'Data';
      } else if (await communicationAgent.processApprovalDecision(approvalId, body.approved, body.feedback)) {
        processed = true;
        agent = 'Communication';
      }
      
      if (!processed) {
        return {
          status: 404,
          jsonBody: { error: `Approval ${approvalId} not found or already processed` }
        };
      }
      
      return {
        status: 200,
        jsonBody: {
          message: `Approval ${body.approved ? 'granted' : 'rejected'}`,
          approvalId: approvalId,
          approved: body.approved,
          agent: agent,
          feedback: body.feedback || ''
        }
      };
    } catch (error) {
      console.error('Failed to process approval:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to process approval' }
      };
    }
  }
});

/**
 * Get status of a specific approval
 */
app.http('getApprovalStatus', {
  methods: ['GET'],
  route: 'approval/{approvalId}/status',
  handler: async (request: HttpRequest): Promise<HttpResponseInit> => {
    try {
      const approvalId = request.params.approvalId;
      
      if (!approvalId) {
        return {
          status: 400,
          jsonBody: { error: 'approvalId is required' }
        };
      }
      
      // Check all agents for the approval
      let approval = financialAgent.getPendingApproval(approvalId);
      let agent = 'Financial';
      
      if (!approval) {
        approval = dataAgent.getPendingApproval(approvalId);
        agent = 'Data';
      }
      
      if (!approval) {
        approval = communicationAgent.getPendingApproval(approvalId);
        agent = 'Communication';
      }
      
      if (!approval) {
        return {
          status: 404,
          jsonBody: { error: `Approval ${approvalId} not found` }
        };
      }
      
      return {
        status: 200,
        jsonBody: {
          approvalId: approvalId,
          agent: agent,
          status: approval.status,
          toolName: approval.toolName,
          toolArgs: approval.toolArgs,
          reasoning: approval.reasoning,
          sessionId: approval.sessionId,
          timestamp: approval.timestamp,
          decidedAt: approval.decidedAt,
          feedback: approval.feedback
        }
      };
    } catch (error) {
      console.error('Failed to get approval status:', error);
      return {
        status: 500,
        jsonBody: { error: 'Failed to get approval status' }
      };
    }
  }
});

console.log('');
console.log('🔄 Human Approval API:');
console.log('   📋 Pending: GET /api/approvals/pending');
console.log('   ✅ Approve/Reject: POST /api/approval/{approvalId}');
console.log('   📊 Status: GET /api/approval/{approvalId}/status');
console.log('');
console.log('// Check for pending approvals:');
console.log('GET /api/financialagent/approvals/payment-demo');
console.log('');
console.log('// Approve or reject:');
console.log('POST /api/financialagent/approvals/payment-demo');
console.log('{ "approvalId": "approval-guid", "decision": "approved", "humanResponse": "Verified with user - approved" }');