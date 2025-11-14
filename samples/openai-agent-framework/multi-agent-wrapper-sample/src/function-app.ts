/**
 * Multi-Agent Azure Functions App using Durable Wrappers
 * 
 * This example demonstrates how to create multiple AI agents
 * in the same function app without naming conflicts using
 * the simplified Tool and DurableWrapper APIs.
 */

import { createTool, createParameter, ToolRegistry } from './Tool';
import { DurableOpenAiAgentWrapper } from './durableWrapper';

// ===== MATH AGENT =====

const mathToolRegistry = new ToolRegistry();

mathToolRegistry.registerTool(createTool({
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

mathToolRegistry.registerTool(createTool({
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

const mathAgent = new DurableOpenAiAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'MathAgent',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    systemPrompt: 'You are a helpful math assistant that can calculate squares and factorials. Always use the provided tools for calculations.'
  },
  mathToolRegistry
);

// ===== WEATHER AGENT =====

const weatherToolRegistry = new ToolRegistry();

weatherToolRegistry.registerTool(createTool({
  name: 'getCurrentWeather',
  description: 'Get current weather for a location',
  parameters: {
    location: createParameter('string', 'The city and state, e.g. San Francisco, CA')
  },
  handler: async (location: string) => {
    // Mock weather data - in real implementation, call weather API
    const mockWeather = {
      'San Francisco, CA': 'Sunny, 72°F',
      'New York, NY': 'Cloudy, 65°F',
      'London, UK': 'Rainy, 58°F'
    };
    
    const weather = mockWeather[location as keyof typeof mockWeather] || 'Weather data not available';
    return `Current weather in ${location}: ${weather}`;
  }
}));

weatherToolRegistry.registerTool(createTool({
  name: 'getWeatherForecast',
  description: 'Get 5-day weather forecast for a location',
  parameters: {
    location: createParameter('string', 'The city and state, e.g. San Francisco, CA')
  },
  handler: async (location: string) => {
    // Mock forecast data
    return `5-day forecast for ${location}: Mon: Sunny 75°F, Tue: Partly Cloudy 73°F, Wed: Rainy 68°F, Thu: Sunny 76°F, Fri: Cloudy 71°F`;
  }
}));

const weatherAgent = new DurableOpenAiAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'WeatherAgent',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    systemPrompt: 'You are a helpful weather assistant that provides current weather and forecasts. Always use the provided tools to get weather information.'
  },
  weatherToolRegistry
);

// ===== TRANSLATION AGENT =====

const translationToolRegistry = new ToolRegistry();

translationToolRegistry.registerTool(createTool({
  name: 'translateText',
  description: 'Translate text between languages',
  parameters: {
    text: createParameter('string', 'The text to translate'),
    targetLanguage: createParameter('string', 'The target language (e.g., Spanish, French, German)')
  },
  handler: async (text: string, targetLanguage: string) => {
    // Mock translation - in real implementation, call translation API
    const mockTranslations: Record<string, Record<string, string>> = {
      'Spanish': {
        'hello': 'hola',
        'goodbye': 'adiós',
        'thank you': 'gracias'
      },
      'French': {
        'hello': 'bonjour',
        'goodbye': 'au revoir',
        'thank you': 'merci'
      }
    };
    
    const translation = mockTranslations[targetLanguage]?.[text.toLowerCase()] || 
                       `[Translation to ${targetLanguage}]: ${text}`;
    
    return `Translation: "${text}" in ${targetLanguage} is "${translation}"`;
  }
}));

const translationAgent = new DurableOpenAiAgentWrapper(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'TranslationAgent',
    model: 'gpt-4o-mini', 
    temperature: 0.1,
    systemPrompt: 'You are a helpful translation assistant that can translate text between languages. Always use the provided tools for translations.'
  },
  translationToolRegistry
);

// ===== INITIALIZE ALL AGENTS =====

console.log('🚀 Initializing Multi-Agent System...');

// Each agent creates unique durable functions and endpoints:
// MathAgent: MathAgentConversationEntity, MathAgentChatOrchestrator, MathAgentProcessChatActivity
// WeatherAgent: WeatherAgentConversationEntity, WeatherAgentChatOrchestrator, WeatherAgentProcessChatActivity  
// TranslationAgent: TranslationAgentConversationEntity, TranslationAgentChatOrchestrator, TranslationAgentProcessChatActivity

mathAgent.run();
weatherAgent.run(); 
translationAgent.run();

console.log('✅ Multi-Agent System Ready!');
console.log('📍 Available Endpoints:');
console.log('   📊 Math Agent: POST /api/mathagent/chat/{sessionId}');
console.log('   🌤️  Weather Agent: POST /api/weatheragent/chat/{sessionId}'); 
console.log('   🗣️  Translation Agent: POST /api/translationagent/chat/{sessionId}');
console.log('   📋 Health Checks: GET /api/{agent}/health');

// Example usage:
// POST /api/mathagent/chat with body: { "message": "What is 5 squared?", "sessionId": "math-session-123" }
// POST /api/weatheragent/chat with body: { "message": "What's the weather in San Francisco?", "sessionId": "weather-session-456" }
// POST /api/translationagent/chat with body: { "message": "Translate 'hello' to Spanish", "sessionId": "translation-session-789" }
//
// Response includes:
// {
//   "success": true,
//   "message": "AI response here",
//   "sessionId": "math-session-123",  // Exactly as provided by customer
//   "instanceId": "orchestrator-guid",
//   "stateEndpoint": "/api/mathagent/state/math-session-123",
//   "timestamp": "2025-11-14T10:00:00.000Z",
//   "processingTimeMs": 1500
// }