/**
 * Multi-Agent Azure Functions Application
 * 
 * This application demonstrates how to create and deploy multiple AI agents
 * within a single Azure Functions app using the Durable Agent Orchestrator.
 * Each agent has its own tools, personality, and endpoints while sharing
 * the same infrastructure and avoiding naming conflicts.
 * 
 * Architecture:
 * - Each agent gets unique durable functions (entities, orchestrators, activities)
 * - Agents operate independently with separate conversation state
 * - All agents share the same OpenAI API key and function app resources
 * - HTTP endpoints are automatically generated based on agent names
 */

import { createTool, createParameter, ToolRegistry } from './Tool';
import { DurableOpenAiAgentOrchestrator } from './durableAgentOrchestrator';

/*
 * ============================================================================
 * MATH AGENT - Handles mathematical calculations
 * ============================================================================
 * This agent specializes in mathematical operations like squares and factorials.
 * It demonstrates tool registration and mathematical function calling.
 */

const mathToolRegistry = new ToolRegistry();

// Register square calculation tool
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

// Register factorial calculation tool
mathToolRegistry.registerTool(createTool({
  name: 'calculateFactorial',
  description: 'Calculate the factorial of a number (n!)',
  parameters: {
    number: createParameter('number', 'The number to calculate factorial for')
  },
  handler: async (number: number) => {
    // Validate input
    if (number < 0) return 'Cannot calculate factorial of negative number';
    
    // Calculate factorial using iterative approach
    let factorial = 1;
    for (let i = 1; i <= number; i++) {
      factorial *= i;
    }
    return `The factorial of ${number} is ${factorial}`;
  }
}));

// Create the Math Agent with specialized configuration
const mathAgent = new DurableOpenAiAgentOrchestrator(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'MathAgent',
    model: 'gpt-4o-mini',
    temperature: 0.7, // Moderate creativity for explanations
    systemPrompt: 'You are a helpful math assistant that can calculate squares and factorials. Always use the provided tools for calculations and explain your work clearly.'
  },
  mathToolRegistry
);

/*
 * ============================================================================
 * WEATHER AGENT - Provides weather information and forecasts
 * ============================================================================
 * This agent handles weather-related queries using mock data.
 * In production, these tools would integrate with real weather APIs.
 */

const weatherToolRegistry = new ToolRegistry();

// Register current weather tool
weatherToolRegistry.registerTool(createTool({
  name: 'getCurrentWeather',
  description: 'Get current weather conditions for a specific location',
  parameters: {
    location: createParameter('string', 'The city and state, e.g. San Francisco, CA')
  },
  handler: async (location: string) => {
    // Mock weather data - in production, integrate with OpenWeatherMap, WeatherAPI, etc.
    const mockWeather = {
      'San Francisco, CA': 'Sunny, 72°F (22°C), Light breeze from west',
      'New York, NY': 'Cloudy, 65°F (18°C), Humidity 78%',
      'London, UK': 'Rainy, 58°F (14°C), Heavy rain expected'
    };
    
    const weather = mockWeather[location as keyof typeof mockWeather] || 
                   `Weather data not available for ${location}. Try major cities like San Francisco, CA or New York, NY.`;
    return `Current weather in ${location}: ${weather}`;
  }
}));

// Register weather forecast tool
weatherToolRegistry.registerTool(createTool({
  name: 'getWeatherForecast',
  description: 'Get 5-day weather forecast for a location',
  parameters: {
    location: createParameter('string', 'The city and state, e.g. San Francisco, CA')
  },
  handler: async (location: string) => {
    // Mock 5-day forecast data - in production, use real weather API
    const forecasts = {
      'San Francisco, CA': 'Mon: Sunny 75°F, Tue: Partly Cloudy 73°F, Wed: Rainy 68°F, Thu: Sunny 76°F, Fri: Cloudy 71°F',
      'New York, NY': 'Mon: Cloudy 67°F, Tue: Rain 62°F, Wed: Sunny 70°F, Thu: Partly Cloudy 69°F, Fri: Sunny 72°F',
      'London, UK': 'Mon: Rainy 59°F, Tue: Cloudy 61°F, Wed: Sunny 65°F, Thu: Rainy 58°F, Fri: Partly Cloudy 63°F'
    };
    
    const forecast = forecasts[location as keyof typeof forecasts] ||
                    `5-day forecast not available for ${location}`;
    return `5-day forecast for ${location}: ${forecast}`;
  }
}));

// Create the Weather Agent with conservative temperature for factual responses
const weatherAgent = new DurableOpenAiAgentOrchestrator(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'WeatherAgent',
    model: 'gpt-4o-mini',
    temperature: 0.3, // Low temperature for factual weather information
    systemPrompt: 'You are a professional weather assistant that provides current weather and forecasts. Always use the provided tools to get accurate weather information. Be helpful and provide context about weather conditions.'
  },
  weatherToolRegistry
);

/*
 * ============================================================================
 * TRANSLATION AGENT - Handles text translation between languages
 * ============================================================================
 * This agent provides basic translation services using mock data.
 * In production, integrate with Azure Translator, Google Translate, or similar APIs.
 */

const translationToolRegistry = new ToolRegistry();

// Register text translation tool
translationToolRegistry.registerTool(createTool({
  name: 'translateText',
  description: 'Translate text from one language to another',
  parameters: {
    text: createParameter('string', 'The text to translate'),
    targetLanguage: createParameter('string', 'The target language (e.g., Spanish, French, German)')
  },
  handler: async (text: string, targetLanguage: string) => {
    // Mock translation service - in production, use Azure Translator, Google Translate, etc.
    const mockTranslations: Record<string, Record<string, string>> = {
      'Spanish': {
        'hello': 'hola',
        'goodbye': 'adiós',
        'thank you': 'gracias',
        'good morning': 'buenos días',
        'good night': 'buenas noches'
      },
      'French': {
        'hello': 'bonjour',
        'goodbye': 'au revoir',
        'thank you': 'merci',
        'good morning': 'bonjour',
        'good night': 'bonne nuit'
      },
      'German': {
        'hello': 'hallo',
        'goodbye': 'auf wiedersehen',
        'thank you': 'danke',
        'good morning': 'guten morgen',
        'good night': 'gute nacht'
      }
    };
    
    // Look up translation or provide fallback
    const translation = mockTranslations[targetLanguage]?.[text.toLowerCase()] || 
                       `[Mock Translation to ${targetLanguage}]: ${text}`;
    
    return `Translation: "${text}" in ${targetLanguage} is "${translation}"`;
  }
}));

// Create the Translation Agent with very low temperature for accurate translations
const translationAgent = new DurableOpenAiAgentOrchestrator(
  process.env.OPENAI_API_KEY || '',
  {
    name: 'TranslationAgent',
    model: 'gpt-4o-mini', 
    temperature: 0.1, // Very low temperature for consistent, accurate translations
    systemPrompt: 'You are a professional translation assistant that translates text between languages. Always use the provided tools for translations and provide helpful context about the translation.'
  },
  translationToolRegistry
);

/*
 * ============================================================================
 * AGENT INITIALIZATION AND STARTUP
 * ============================================================================
 * This section initializes all agents and sets up their durable functions.
 * Each agent automatically creates its own isolated set of:
 * - Conversation Entity (manages chat history)
 * - Chat Orchestrator (coordinates the conversation flow)
 * - Process Chat Activity (handles OpenAI API calls)
 * - HTTP endpoints (chat, state, health check)
 */

console.log('🚀 Initializing Multi-Agent System...');

// Initialize each agent - this creates their durable functions and HTTP endpoints
// Each agent gets unique function names to avoid conflicts:
// - MathAgent: MathAgentConversationEntity, MathAgentChatOrchestrator, MathAgentProcessChatActivity
// - WeatherAgent: WeatherAgentConversationEntity, WeatherAgentChatOrchestrator, WeatherAgentProcessChatActivity  
// - TranslationAgent: TranslationAgentConversationEntity, TranslationAgentChatOrchestrator, TranslationAgentProcessChatActivity

mathAgent.run();        // Creates /api/mathagent/* endpoints
weatherAgent.run();     // Creates /api/weatheragent/* endpoints
translationAgent.run(); // Creates /api/translationagent/* endpoints

console.log('✅ Multi-Agent System Ready!');
console.log('📍 Available Endpoints: 📊 Math: /api/mathagent/chat/{sessionId} | 🌤️ Weather: /api/weatheragent/chat/{sessionId} | 🗣️ Translation: /api/translationagent/chat/{sessionId} | 📋 Health: /api/{agent}/health');
