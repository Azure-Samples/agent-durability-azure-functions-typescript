/**
 * Simple Math Agent - Azure Functions with Durable Orchestrator
 * 
 * This is a clean, production-ready example showing how to create
 * an AI agent with mathematical capabilities using Azure Functions
 * and the Durable Agent Orchestrator pattern.
 * 
 * Features:
 * - Mathematical calculations (square, factorial, expressions)
 * - Persistent conversation state using Durable Entities
 * - Automatic HTTP endpoint generation
 * - Built-in health monitoring
 * - Session-based chat management
 */

import { createTool, createParameter, ToolRegistry } from './Tool';
import { DurableOpenAiAgentOrchestrator } from './durableAgentOrchestrator';

/*
 * ============================================================================
 * TOOL REGISTRY SETUP
 * ============================================================================
 * Define all the mathematical tools that our AI agent can use.
 * Each tool is registered with the ToolRegistry for automatic OpenAI integration.
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
    // Input validation - factorial not defined for negative numbers
    if (number < 0) {
      return 'Cannot calculate factorial of negative number';
    }
    
    // Calculate factorial using iterative method
    let factorial = 1;
    for (let i = 1; i <= number; i++) {
      factorial *= i;
    }
    
    return `The factorial of ${number} is ${factorial}`;
  }
}));

// Tool 3: Expression Solver
// Safely evaluates mathematical expressions like "5 + 3 * 2"
toolRegistry.registerTool(createTool({
  name: 'solveEquation', 
  description: 'Solve simple mathematical expressions with basic operations',
  parameters: {
    expression: createParameter('string', 'The mathematical expression to solve (e.g., "5 + 3 * 2")')
  },
  handler: async (expression: string) => {
    try {
      // Security check: Only allow safe mathematical characters
      // Prevents code injection by restricting to numbers and basic operators
      const allowedChars = /^[0-9+\-*/.() ]+$/;
      
      if (allowedChars.test(expression)) {
        // Safely evaluate the mathematical expression
        const result = new Function('return ' + expression)();
        return `The result of ${expression} is ${result}`;
      } else {
        return `Invalid expression: ${expression}. Only numbers and basic operations (+, -, *, /, parentheses) are allowed.`;
      }
    } catch (error) {
      return `Error solving expression '${expression}': ${error}`;
    }
  }
}));

// Tool 4: Greeting Function
// Simple tool that doesn't require parameters - demonstrates parameterless tools
toolRegistry.registerTool(createTool({
  name: 'hello',
  description: 'Returns a friendly greeting from the math assistant',
  parameters: {}, // No parameters needed
  handler: async () => {
    return 'Hello! I\'m your friendly math assistant. I can calculate squares, factorials, and solve basic mathematical expressions!';
  }
}));

/*
 * ============================================================================
 * AGENT CONFIGURATION AND INITIALIZATION
 * ============================================================================
 * Create the AI agent with OpenAI integration and durable state management.
 * The agent automatically handles conversation state, tool calling, and HTTP endpoints.
 */

const agent = new DurableOpenAiAgentOrchestrator(
  // OpenAI API Key from environment variables
  process.env.OPENAI_API_KEY || '',
  
  // Agent configuration
  {
    name: 'MathAgent',                    // Used for endpoint naming and identification
    model: 'gpt-4o-mini',               // OpenAI model - cost-effective and fast
    temperature: 0.7,                    // Moderate creativity for explanations
    systemPrompt: 'You are a helpful math assistant that can calculate squares, factorials, and solve simple expressions. Always use the provided tools for calculations and explain your work step by step.'
  },
  
  // Tool registry containing all available functions
  toolRegistry
);

/*
 * ============================================================================
 * AGENT STARTUP AND DEPLOYMENT
 * ============================================================================
 * Start the agent and automatically create all necessary Azure Functions.
 * This single command sets up the complete infrastructure:
 */

// Initialize the agent - this creates all durable functions and HTTP endpoints
agent.run();

/*
 * What agent.run() automatically creates:
 * 
 * 1. DURABLE FUNCTIONS:
 *    - MathAgentConversationEntity: Manages chat history and session state
 *    - MathAgentChatOrchestrator: Coordinates conversation flow
 *    - MathAgentProcessChatActivity: Handles OpenAI API calls and tool execution
 * 
 * 2. HTTP ENDPOINTS:
 *    - POST /api/mathagent/chat/{sessionId} - Send messages to the agent
 *    - GET /api/mathagent/state/{sessionId} - Get conversation history
 *    - GET /api/mathagent/health - Check agent health and configuration
 * 
 * 3. FEATURES:
 *    - Persistent conversation state across requests
 *    - Automatic tool calling with OpenAI function calling
 *    - Session management with custom or auto-generated IDs
 *    - Error handling and logging throughout the pipeline
 */

console.log('🎉 Math Agent deployed successfully! Ready to solve mathematical problems.');