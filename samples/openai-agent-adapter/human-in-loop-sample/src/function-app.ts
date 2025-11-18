/**
 * Human-in-the-Loop Financial Agent - Azure Functions App
 * 
 * This example demonstrates a single AI agent that requires human approval for sensitive financial operations.
 * The Financial Agent can check balances and generate reports immediately, but requires human approval for payments.
 */

import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { createTool, createParameter, ToolRegistry } from './Tool';
import { HumanInLoopDurableAgentOrchestrator } from './durableAgentOrchestrator';

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

const financialAgent = new HumanInLoopDurableAgentOrchestrator(
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

// ===== INITIALIZE FINANCIAL AGENT =====

console.log('🚀 Initializing Human-in-the-Loop Financial Agent System...');

// Financial Agent creates unique durable functions and endpoints with human approval workflows:
// FinancialAgent: Handles payments (with approval), balance checks (no approval), reports (no approval)

financialAgent.run();

console.log('✅ Human-in-the-Loop Financial Agent System Ready!');
console.log('📍 Available Endpoints:');
console.log('');
console.log('💰 Financial Agent:');
console.log('   💬 Chat: POST /api/financialagent/chat/{sessionId}');
console.log('   ✅ Approve: POST /api/financialagent/approve/{sessionId}');
console.log('   📈 Status: GET /api/financialagent/status/{sessionId}');
console.log('');
console.log('🔒 Human Approval Required For:');
console.log('   💸 Financial: makePayment');
console.log('');
console.log('✅ Safe Operations (No Approval):');
console.log('   💰 Financial: checkAccountBalance, generateReport');

// Example usage scenarios:
console.log('');
console.log('💡 Example Usage:');
console.log('');
console.log('// Safe operation (no approval needed):');
console.log('POST /api/financialagent/chat/my-session');
console.log('{ "message": "What is my account balance for account 12345?" }');
console.log('');
console.log('// Dangerous operation (requires human approval):');
console.log('POST /api/financialagent/chat/payment-session');
console.log('{ "message": "Transfer $5000 from account 12345 to account 67890" }');
console.log('// Response includes: sessionId, requiresApproval: true');
console.log('');
console.log('// Check session status:');
console.log('GET /api/financialagent/status/payment-session');
console.log('');
console.log('// Approve or reject the operation:');
console.log('POST /api/financialagent/approve/payment-session');
console.log('{ "approved": true, "feedback": "Emergency payment approved by CFO" }');



console.log('');
console.log('🎯 Simplified Session-Based Approval Workflow:');
console.log('   ✅ Approve by Session: POST /api/financialagent/approve/{sessionId}');
console.log('   📈 Check Status: GET /api/financialagent/status/{sessionId}');
console.log('   🔄 Polling-based workflow with timeouts');
console.log('   📋 sessionId used consistently across all endpoints');
console.log('');

console.log('🎉 Financial Agent with Human-in-the-Loop deployed successfully!');
console.log('Ready to handle financial operations with human oversight for payments.');