/**
 * Simplified Function App using Tool and Durable Agent Orchestrator
 * 
 * This example shows how customers can easily create an AI agent
 * using the provided orchestrator libraries with minimal boilerplate.
 */

import { createTool, createParameter, ToolRegistry } from './Tool';
import { DurableOpenAiAgentOrchestrator } from './durableAgentOrchestrator';

// ===== STEP 1: CREATE TOOL REGISTRY =====

const toolRegistry = new ToolRegistry();

// Define tools using the simplified wrapper
toolRegistry.registerTool(createTool({
  name: 'calculateSquare',
  description: 'Calculate the square of a number',
  parameters: {
    number: createParameter('number', 'The number to square')
  },
  handler: async (number: number) => {
    const result = number * number;
    return `The square of ${number} is ${result}`;
  }
}));

toolRegistry.registerTool(createTool({
  name: 'calculateFactorial',
  description: 'Calculate the factorial of a number',
  parameters: {
    number: createParameter('number', 'The number to calculate factorial for')
  },
  handler: async (number: number) => {
    if (number < 0) return 'Cannot calculate factorial of negative number';
    
    let factorial = 1;
    for (let i = 1; i <= number; i++) {
      factorial *= i;
    }
    return `The factorial of ${number} is ${factorial}`;
  }
}));

toolRegistry.registerTool(createTool({
  name: 'solveEquation', 
  description: 'Solve simple mathematical equations',
  parameters: {
    expression: createParameter('string', 'The mathematical expression to solve')
  },
  handler: async (expression: string) => {
    try {
      // Security: Only allow safe mathematical characters
      const allowedChars = /^[0-9+\-*/.() ]+$/;
      if (allowedChars.test(expression)) {
        const result = new Function('return ' + expression)();
        return `The result of ${expression} is ${result}`;
      }
      return `Invalid expression: ${expression}. Only basic math operations allowed.`;
    } catch (error) {
      return `Error solving expression '${expression}': ${error}`;
    }
  }
}));

toolRegistry.registerTool(createTool({
  name: 'hello',
  description: 'Returns a friendly greeting',
  parameters: {}, // No parameters required
  handler: async () => {
    return `Hello! I'm your friendly math assistant!`;
  }
}));

// ===== STEP 2: CREATE DURABLE AGENT =====

const agent = new DurableOpenAiAgentOrchestrator(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'MathAgent',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    systemPrompt: 'You are a helpful math assistant that can calculate squares, factorials, and solve simple expressions. Always use the provided tools for calculations.'
  },
  toolRegistry
);

// ===== STEP 3: INITIALIZE EVERYTHING =====

// This single call sets up:
// - Durable entity for conversation state
// - Chat orchestrator for workflow management  
// - HTTP endpoints for chat, state, and health
agent.run();

// That's it! Your AI agent is ready with:
// - POST /api/agent/chat/{sessionId} - Chat with the agent
// - GET /api/agent/state/{sessionId} - Get conversation state
// - GET /api/health - Health check

console.log('🎉 AI Agent initialized! Ready to chat with math capabilities.');