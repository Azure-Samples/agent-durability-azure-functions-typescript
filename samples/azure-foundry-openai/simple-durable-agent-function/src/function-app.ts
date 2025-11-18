/**
 * ========================================================================
 * Azure Foundry OpenAI Simple Durable Agent Function
 * ========================================================================
 * 
 * OVERVIEW:
 * This sample demonstrates how to build an intelligent AI agent that:
 * 1. Uses Azure Foundry OpenAI for language model capabilities
 * 2. Leverages Azure Durable Functions for persistent conversation state
 * 3. Implements tool calling for enhanced functionality (calculator, weather, etc.)
 * 4. Uses Azure AD authentication for secure, keyless access
 * 
 * ARCHITECTURE:
 * ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
 * │   HTTP Client   │───▶│  Azure Function  │───▶│  Azure Foundry AI   │
 * │                 │    │  (This Code)     │    │   (Language Model)  │
 * └─────────────────┘    └──────────────────┘    └─────────────────────┘
 *                               │                            │
 *                               ▼                            │
 *                        ┌──────────────────┐              │
 *                        │ Durable Functions│              │
 *                        │ (State Storage)  │              │
 *                        └──────────────────┘              │
 *                               │                            │
 *                               ▼                            ▼
 *                        ┌──────────────────┐    ┌─────────────────────┐
 *                        │   Tool Registry  │    │    Tool Execution   │
 *                        │  (This Code)     │    │   (This Code)       │
 *                        └──────────────────┘    └─────────────────────┘
 * 
 * FLOW:
 * 1. Client sends message → HTTP endpoint
 * 2. Durable orchestrator manages conversation state
 * 3. Azure Foundry OpenAI processes the message
 * 4. If tools needed, AI calls registered functions
 * 5. Tool results are sent back to AI for final response
 * 6. Response returned to client with updated conversation state
 */


/**
 * 🔢 Simple Math Agent - Azure Functions with Azure Foundry OpenAI
 * 
 * This is a clean, production-ready example showing how to create
 * an AI agent with mathematical capabilities using Azure Functions,
 * Azure Foundry OpenAI, and the Durable Agent Orchestrator pattern.
 * 
 * ============================================================================
 * 🚀 QUICK START GUIDE
 * ============================================================================
 * 
 * 1. Prerequisites:
 *    - Azure subscription with Azure Functions and Azure OpenAI services
 *    - Azure Foundry OpenAI resource configured
 *    - Azure CLI (az login) for authentication
 *    - Node.js 18+ and Azure Functions Core Tools 4.x
 * 
 * 2. Setup:
 *    npm install
 *    npm run build
 *    npm start
 * 
 * 3. Test the Agent:
 *    POST http://localhost:7071/api/mathagent/chat/session123
 *    Content-Type: application/json
 *    {"message": "What is 12 squared?"}
 * 
 * ============================================================================
 * 🔧 API ENDPOINTS REFERENCE
 * ============================================================================
 * 
 * 📨 Chat with Math Agent:
 *    POST /api/mathagent/chat/{sessionId}
 *    Body: {"message": "Calculate 5 factorial"}
 *    Response: 202 (Processing started in background)
 * 
 * 📊 Check Processing Status:
 *    GET /api/mathagent/orchestrator/{instanceId}
 *    Response: Current orchestration status and progress
 * 
 * 🔍 Get Conversation History:
 *    GET /api/mathagent/state/{sessionId}
 *    Response: Chat history and session information
 * 
 * 💚 Health Check:
 *    GET /api/mathagent/health
 *    Response: Service status and configuration info
 * 
 * ============================================================================
 * 🛠️ AVAILABLE MATHEMATICAL TOOLS
 * ============================================================================
 * 
 * • calculateSquare: Computes n² for any number
 *   Example: "What is 15 squared?"
 * 
 * • calculateFactorial: Calculates n! for numbers up to 20
 *   Example: "Calculate 6 factorial"
 * 
 * • evaluateExpression: Safely evaluates math expressions
 *   Example: "What is (3 + 4) * 2?"
 *   Supports: +, -, *, /, parentheses
 * 
 * • getNumberInfo: Analyzes number properties
 *   Example: "Tell me about the number 28"
 *   Returns: even/odd, prime status, perfect square info
 * 
 * ============================================================================
 * 🔐 AUTHENTICATION & SECURITY
 * ============================================================================
 * 
 * This sample uses Azure AD authentication (recommended):
 * - No API keys required in code
 * - Uses DefaultAzureCredential for secure token management
 * - Supports managed identity in Azure deployments
 * - Fallback to environment variables if needed
 * 
 * Required Environment Variables:
 * - AZURE_OPENAI_ENDPOINT: Your Azure OpenAI endpoint URL
 * - AZURE_OPENAI_DEPLOYMENT_NAME: Model deployment name (optional, defaults to gpt-4o-mini)
 * 
 * ============================================================================
 * 🏗️ ARCHITECTURE OVERVIEW
 * ============================================================================
 * 
 * ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
 * │   HTTP Request  │───▶│  Durable         │───▶│  Azure Foundry      │
 * │   (Immediate    │    │  Orchestrator    │    │  OpenAI             │
 * │    202 Response)│    │  (Background     │    │  (Tool Execution)   │
 * └─────────────────┘    │   Processing)    │    └─────────────────────┘
 *                        └──────────────────┘                │
 *                                 │                          │
 *                        ┌──────────────────┐              │
 *                        │  Durable Entity  │◀─────────────┘
 *                        │  (Conversation   │
 *                        │   State Storage) │
 *                        └──────────────────┘
 * 
 * ============================================================================
 * 📖 EXAMPLE USAGE SCENARIOS
 * ============================================================================
 * 
 * Basic Calculations:
 * User: "What is 144 squared?"
 * Agent: Uses calculateSquare tool → "The square of 144 is 20,736"
 * 
 * Factorial Calculations:
 * User: "Calculate 7 factorial"
 * Agent: Uses calculateFactorial tool → "7! = 5040"
 * 
 * Complex Expressions:
 * User: "What is (15 + 3) * 2 - 10?"
 * Agent: Uses evaluateExpression tool → "(15 + 3) * 2 - 10 = 26"
 * 
 * Number Analysis:
 * User: "Is 17 prime?"
 * Agent: Uses getNumberInfo tool → "Number: 17, Type: Odd, Prime: Yes"
 * 
 * Multi-step Problems:
 * User: "What's 5 factorial plus 3 squared?"
 * Agent: Uses both tools → "5! = 120 and 3² = 9, so 120 + 9 = 129"
 * 
 * ============================================================================
 * 🚨 TROUBLESHOOTING GUIDE
 * ============================================================================
 * 
 * Common Issues & Solutions:
 * 
 * 1. "Missing AZURE_OPENAI_ENDPOINT" Error:
 *    → Set AZURE_OPENAI_ENDPOINT in local.settings.json
 *    → Verify your Azure OpenAI resource URL
 * 
 * 2. Authentication Failures:
 *    → Run 'az login' to authenticate with Azure CLI
 *    → Check Azure OpenAI role assignments
 *    → Verify subscription and resource group access
 * 
 * 3. "Orchestrator stuck in Pending":
 *    → Check Azure Functions Core Tools version (4.x required)
 *    → Verify all dependencies are installed (npm install)
 *    → Check console logs for detailed error messages
 * 
 * 4. Tool Execution Errors:
 *    → Ensure input values are within supported ranges
 *    → Check tool parameter types (number vs string)
 *    → Verify expression syntax for evaluateExpression
 * 
 * 5. Build/Runtime Errors:
 *    → Run 'npm run build' to check TypeScript compilation
 *    → Ensure Node.js version 18 or higher
 *    → Verify all import statements are correct
 * 
 * For more help, check the README.md file or Azure documentation.
 * 
 * ============================================================================
 * 💡 DEVELOPMENT FEATURES
 * ============================================================================
 * 
 * • Comprehensive Logging: Detailed console output for debugging
 * • Error Handling: Graceful fallbacks and informative error messages
 * • Type Safety: Full TypeScript support with proper interfaces
 * • Extensibility: Easy to add new mathematical tools
 * • Production Ready: Enterprise-grade security and scalability
 * • Async Processing: Non-blocking background orchestration
 * • Session Management: Persistent conversation state across requests
 * • Health Monitoring: Built-in endpoints for service monitoring
 */

import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { createTool, createParameter, ToolRegistry } from './Tool';
import { AzureFoundryAgentOrchestrator, AgentConfig } from './durableAgentOrchestrator';

/*
 * ============================================================================
 * TOOL REGISTRY SETUP
 * ============================================================================
 * Define all the mathematical tools that our AI agent can use.
 * Each tool is registered with the ToolRegistry for automatic Azure Foundry OpenAI integration.
 */

const toolRegistry = new ToolRegistry();

// Tool 1: Square Calculator
// Calculates the square of any number (n²)
toolRegistry.registerTool(createTool({
  name: 'calculateSquare',
  description: 'Calculate the square of a number (multiply by itself)',
  parameters: {
    number: createParameter('number', 'The number to square')
  },
  handler: async (number: number) => {
    const result = number * number;
    return `The square of ${number} is ${result}`;
  }
}));

// Tool 2: Factorial Calculator  
// Calculates factorial (n!) = n × (n-1) × (n-2) × ... × 1
toolRegistry.registerTool(createTool({
  name: 'calculateFactorial',
  description: 'Calculate the factorial of a number (n!)',
  parameters: {
    number: createParameter('number', 'The number to calculate factorial for')
  },
  handler: async (number: number) => {
    if (number < 0) return 'Error: Factorial is not defined for negative numbers';
    if (number > 20) return 'Error: Number too large (max 20 for safety)';
    
    let result = 1;
    for (let i = 2; i <= number; i++) {
      result *= i;
    }
    return `${number}! = ${result}`;
  }
}));

// Tool 3: Mathematical Expression Evaluator
// Safely evaluates mathematical expressions
toolRegistry.registerTool(createTool({
  name: 'evaluateExpression',  
  description: 'Evaluate a mathematical expression (supports +, -, *, /, parentheses)',
  parameters: {
    expression: createParameter('string', 'The mathematical expression to evaluate')
  },
  handler: async (expression: string) => {
    try {
      // Basic safety check - only allow numbers, operators, and parentheses
      if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
        return 'Error: Invalid characters in expression. Only numbers and +, -, *, /, () allowed.';
      }
      
      // Evaluate using Function constructor (safer than eval)
      const result = Function(`"use strict"; return (${expression})`)();
      
      if (typeof result !== 'number' || !isFinite(result)) {
        return 'Error: Expression does not evaluate to a valid number';
      }
      
      return `${expression} = ${result}`;
    } catch (error) {
      return `Error evaluating expression: ${error}`;
    }
  }
}));

// Tool 4: Number Information
// Provides interesting mathematical properties of numbers
toolRegistry.registerTool(createTool({
  name: 'getNumberInfo',
  description: 'Get interesting mathematical information about a number',
  parameters: {
    number: createParameter('number', 'The number to analyze')
  },
  handler: async (number: number) => {
    if (!Number.isInteger(number) || number < 0) {
      return 'Please provide a positive integer';
    }
    
    const info = [];
    info.push(`Number: ${number}`);
    
    // Check if even/odd
    info.push(`Type: ${number % 2 === 0 ? 'Even' : 'Odd'}`);
    
    // Check if prime (for small numbers)
    if (number <= 100) {
      const isPrime = number > 1 && Array.from({length: Math.sqrt(number)}, (_, i) => i + 2)
        .every(i => number % i !== 0);
      info.push(`Prime: ${isPrime ? 'Yes' : 'No'}`);
    }
    
    // Perfect square check
    const sqrt = Math.sqrt(number);
    if (Number.isInteger(sqrt)) {
      info.push(`Perfect square: Yes (${sqrt}²)`);
    }
    
    return info.join(', ');
  }
}));

/*
 * ============================================================================
 * AGENT CONFIGURATION
 * ============================================================================
 * Configure the Azure Foundry OpenAI agent with mathematical capabilities
 */

const agentConfig: AgentConfig = {
  name: 'MathAgent',
  deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini',
  temperature: 0.7,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  systemPrompt: `You are MathAgent, a helpful AI assistant specialized in mathematics.

Available mathematical tools:
🔢 calculateSquare: Calculate the square of any number
  calculateFactorial: Calculate factorial (n!) for numbers up to 20
🧮 evaluateExpression: Evaluate mathematical expressions with +, -, *, /, ()
🔍 getNumberInfo: Get interesting properties of numbers (even/odd, prime, perfect square)

You excel at:
- Basic arithmetic and calculations
- Explaining mathematical concepts clearly
- Helping solve math problems step by step
- Providing interesting mathematical facts

When users ask mathematical questions, use the appropriate tools and explain your reasoning clearly.`
};

/*
 * Configuration Validation and Logging
 * 
 * Educational Note: Always validate configuration before proceeding.
 * Missing endpoints are a common deployment issue, so we check early
 * and provide clear error messages to help with troubleshooting.
 */

console.log('[INIT] 🚀 Initializing Assistant with Azure Foundry OpenAI...');
console.log('[INIT] 🔐 Using secure Azure AD authentication');

// Validate required configuration
if (!agentConfig.endpoint) {
  console.error('[ERROR] ❌ Missing AZURE_OPENAI_ENDPOINT in local.settings.json');
  console.error('[ERROR] 📝 Please set your Azure OpenAI endpoint in configuration');
} else {
  console.log(`[INIT] ✅ Configuration validated successfully`);
  console.log(`[INIT] 🎯 Target deployment: ${agentConfig.deploymentName}`);
  console.log(`[INIT] 🌡️ Temperature: ${agentConfig.temperature || 0.7}`);
}

/*
 * ============================================================================
 *                         STEP 3: AGENT INITIALIZATION
 * ============================================================================
 * Create the durable agent orchestrator that combines:
 * 1. Azure Foundry OpenAI configuration (defined above)
 * 2. Tool registry (defined earlier)
 * 3. Durable Functions orchestration capabilities
 * 
 * The DurableAzureFoundryAgentOrchestrator class provides:
 * - Persistent conversation state across multiple requests
 * - Automatic tool execution and response handling  
 * - Built-in retry logic and error handling
 * - Session management for multi-turn conversations
 * 
 * Educational Note:
 * Durable Functions are key here because they maintain state between
 * HTTP requests. Without this, each request would be stateless and
 * the AI couldn't maintain context across a conversation.
 */

/*
 * ============================================================================
 * AGENT CREATION & STARTUP  
 * ============================================================================
 * Create the math agent and initialize the Azure Functions runtime
 */

console.log(`[MATH-AGENT] 🤖 Creating MathAgent with Azure Foundry OpenAI...`);
const mathAgent = new AzureFoundryAgentOrchestrator(agentConfig, toolRegistry);

console.log(`[MATH-AGENT] 🚀 Starting MathAgent with ${toolRegistry.getToolCount()} mathematical tools...`);

// Start the agent - this creates all endpoints and durable functions
mathAgent.run();

/*
 * ============================================================================
 *                          MATH AGENT READY  
 * ============================================================================
 * The MathAgent is now fully initialized and ready to solve mathematical problems.
 * 
 * What happens next:
 * 1. HTTP requests arrive at the math agent endpoints
 * 2. Durable orchestrations manage conversation state
 * 3. Azure Foundry OpenAI processes mathematical queries
 * 4. Mathematical tools are executed as needed by the AI
 * 5. Calculated results are returned to the client
 * 
 * Available Mathematical Tools:
 * • calculateSquare: Computes the square of a number
 * • calculateFactorial: Calculates factorial of a number  
 * • evaluateExpression: Safely evaluates math expressions
 * • getNumberInfo: Analyzes properties of numbers
 * 
 * Testing Examples:
 * POST /api/mathagent/chat/session123
 * {"message": "What is 12 squared?"} 
 * {"message": "Calculate 5 factorial"}
 * {"message": "What is (3 + 4) * 2?"}
 */

console.log(`[READY] ✅ MathAgent Ready - ${agentConfig.deploymentName}`);
console.log('[READY] 🔢 Chat: POST /api/mathagent/chat/{sessionId}');
console.log(`[READY] 🛠️ Tools: ${toolRegistry.getToolNames().join(', ')}`);


