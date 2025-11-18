/**
 * Azure Foundry OpenAI Durable Agent Orchestrator
 * 
 * This module orchestrates AI agents using Azure Foundry OpenAI with durable state management.
 * Based on the simple-durable-agent-function pattern but adapted for Azure Foundry OpenAI
 * with Azure AD authentication and enterprise-grade security.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { AzureOpenAI } from 'openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { ToolRegistry } from './Tool';

/**
 * Agent configuration interface for Azure Foundry OpenAI
 */
export interface AgentConfig {
  name: string;
  deploymentName: string;  // Azure OpenAI deployment name (e.g., 'gpt-4o-mini')
  temperature?: number;
  systemPrompt: string;
  endpoint?: string;       // Azure OpenAI endpoint URL
  apiVersion?: string;     // API version (defaults to 2024-10-21)
  // Note: Uses Azure AD authentication by default (no API key needed)
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Entity state interface for conversation management
 */
export interface ConversationState {
  chatHistory: ChatMessage[];
  createdAt: string;
  lastUpdated: string;
}

/**
 * Azure Foundry OpenAI Durable Agent Orchestrator
 * 
 * Orchestrates AI agents with persistent conversation state using Azure Foundry OpenAI.
 * Provides secure, keyless authentication via Azure AD and enterprise-grade AI services.
 * Based on the simple-durable-agent pattern with Azure Foundry OpenAI integration.
 */
export class AzureFoundryAgentOrchestrator {
  private azureOpenAI: AzureOpenAI;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;
  private entityName: string;
  private orchestratorName: string;
  private activityName: string;

  // Static instance for activity access
  private static instance: AzureFoundryAgentOrchestrator;

  constructor(config: AgentConfig, toolRegistry: ToolRegistry) {
    // Use Azure AD token provider for authentication (recommended approach for Azure Foundry)
    const scope = "https://cognitiveservices.azure.com/.default";
    const azureADTokenProvider = getBearerTokenProvider(new DefaultAzureCredential(), scope);
    
    this.azureOpenAI = new AzureOpenAI({ 
      endpoint: config.endpoint,
      azureADTokenProvider, 
      deployment: config.deploymentName,
      apiVersion: config.apiVersion || "2024-10-21"
    });
    
    this.config = config;
    this.toolRegistry = toolRegistry;
    
    // Create simpler, fixed names for better Azure Functions compatibility
    this.entityName = 'conversationEntity';
    this.orchestratorName = 'chatOrchestrator';
    this.activityName = 'processChatActivity';
    
    // Set static instance for activity access
    AzureFoundryAgentOrchestrator.instance = this;

    // Create orchestrator, entity, and activity immediately
    console.log(`[AGENT] 🏗️ Creating orchestrator, entity, and activity functions...`);
    this.createChatOrchestrator();
    this.createConversationEntity();
    this.createProcessChatActivity();

    console.log(`[AGENT] 🤖 ${config.name} initialized - ${config.deploymentName}`);
    console.log(`[AGENT] 🔗 Endpoint: ${config.endpoint || 'Using environment default'}`);
    console.log(`[AGENT] 🛠️ Tools available: ${toolRegistry.getToolCount()}`);
  }

  /**
   * Create and register the durable entity for conversation state management
   */
  createConversationEntity(): void {
    console.log(`[ENTITY] 📝 Creating conversation entity: ${this.entityName}`);
    df.app.entity(this.entityName, (context) => {
      const state: ConversationState = context.df.getState(() => ({
        chatHistory: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      })) as ConversationState;

      const operation = context.df.operationName;
      
      const operations = {
        'addMessage': () => {
          const input = context.df.getInput() as { role: 'user' | 'assistant' | 'system'; content: string };
          console.log(`[ENTITY] ➕ Adding ${input.role} message (${input.content.length} chars)`);
          state.chatHistory.push({
            role: input.role,
            content: input.content,
            timestamp: new Date().toISOString()
          });
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          console.log(`[ENTITY] ✅ Total messages: ${state.chatHistory.length}`);
          return { success: true };
        },
        'getState': () => {
          console.log(`[ENTITY] 📊 Getting state - ${state.chatHistory.length} messages`);
          return {
            messageCount: state.chatHistory.length,
            createdAt: state.createdAt,
            lastUpdated: state.lastUpdated,
            recentMessages: state.chatHistory.slice(-5)
          };
        },
        'getFullHistory': () => {
          console.log(`[ENTITY] 📚 Getting full history - ${state.chatHistory.length} messages`);
          return state.chatHistory;
        },
        'clearHistory': () => {
          const clearedCount = state.chatHistory.length;
          console.log(`[ENTITY] 🧹 Clearing ${clearedCount} messages`);
          state.chatHistory = [];
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          return { success: true, clearedCount };
        }
      };

      const result = operations[operation] ? operations[operation]() : state;
      console.log(`[ENTITY]   Operation '${operation}' completed`);
      return result;
    });
  }

  /**
   * Create and register the processChatActivity
   */
  createProcessChatActivity(): void {
    console.log(`[ACTIVITY] ⚙️ Creating processChatActivity: ${this.activityName}`);
    
    // Store reference to this instance for the activity
    const self = this;
    
    df.app.activity(this.activityName, {
      handler: async (input: { message: string; sessionId: string }): Promise<string> => {
        console.log(`[ACTIVITY] 🚀 processChatActivity STARTED for session: ${input.sessionId}`);
        console.log(`[ACTIVITY] 📝 Message: "${input.message.substring(0, 100)}..."`);
        
        try {
          console.log(`[ACTIVITY] 🤖 Calling executeOpenAIChat...`);
          const response = await self.executeOpenAIChat(input.message);
          console.log(`[ACTIVITY] ✅ executeOpenAIChat SUCCESS! Response: ${response.length} chars`);
          return response;
          
        } catch (error) {
          console.error(`[ACTIVITY] ❌ executeOpenAIChat FAILED:`, error);
          throw new Error(`Activity failed: ${error}`);
        }
      }
    });
    
    console.log(`[ACTIVITY] ✅ processChatActivity created successfully`);
  }

  /**
   * Create and register the chat orchestrator (Direct implementation for immediate execution)
   */
  createChatOrchestrator(): void {
    console.log(`[ORCHESTRATOR] 🎭 Creating direct chat orchestrator: ${this.orchestratorName}`);
    
    // Create the orchestrator directly in the instance
    df.app.orchestration(this.orchestratorName, function* (context) {
      console.log(`[ORCHESTRATOR] 🚀 ORCHESTRATOR STARTED!`);
      
      const inputData = context.df.getInput() as any;
      console.log(`[ORCHESTRATOR] 📥 Raw input received:`, JSON.stringify(inputData));
      
      let message: string, sessionId: string;
      
      if (inputData.input && inputData.input.message) {
        console.log(`[ORCHESTRATOR] 📥 Using wrapped input format`);
        ({ message, sessionId } = inputData.input);
      } else if (inputData.message) {
        console.log(`[ORCHESTRATOR] 📥 Using direct input format`);
        ({ message, sessionId } = inputData);
      } else {
        console.error(`[ORCHESTRATOR] ❌ Invalid input format:`, inputData);
        throw new Error(`Invalid input format: ${JSON.stringify(inputData)}`);
      }
      
      console.log(`[ORCHESTRATOR] 💬 Processing: "${message}" for session: ${sessionId}`);
      context.df.setCustomStatus(`Processing: "${message.substring(0, 50)}..."`);
      
      const entityId = new df.EntityId('conversationEntity', sessionId);
      
      try {
        // Step 1: Store user message
        console.log(`[ORCHESTRATOR] 📝 Step 1: Calling entity to store user message`);
        yield context.df.callEntity(entityId, 'addMessage', { role: 'user', content: message });
        console.log(`[ORCHESTRATOR] ✅ Step 1 completed - user message stored`);
        
        // Step 2: Process with Azure Foundry OpenAI
        console.log(`[ORCHESTRATOR] 🤖 Step 2: Calling activity 'processChatActivity'`);
        const response = yield context.df.callActivity('processChatActivity', { message, sessionId });
        console.log(`[ORCHESTRATOR] ✅ Step 2 completed - got response: "${response.substring(0, 100)}..."`);
        
        // Step 3: Store assistant response  
        console.log(`[ORCHESTRATOR] 💾 Step 3: Calling entity to store assistant response`);
        yield context.df.callEntity(entityId, 'addMessage', { role: 'assistant', content: response });
        console.log(`[ORCHESTRATOR] ✅ Step 3 completed - assistant response stored`);
        
        context.df.setCustomStatus(`Completed successfully`);
        console.log(`[ORCHESTRATOR] 🎉 ORCHESTRATOR COMPLETED SUCCESSFULLY!`);
        return { success: true, response, sessionId, completedAt: new Date().toISOString() };
        
      } catch (error) {
        context.df.setCustomStatus(`Failed: ${error}`);
        console.error(`[ORCHESTRATOR] ❌ ORCHESTRATOR FAILED:`, error);
        throw error;
      }
    });
  }

  /**
   * Static method to register durable functions at module load time
   */
  static registerDurableFunctions(): void {
    console.log(`[SETUP] 🏗️ Registering durable functions at module level...`);
    
    // Register the orchestrator
    console.log(`[SETUP] 🎭 Registering chatOrchestrator`);
    df.app.orchestration('chatOrchestrator', function* (context) {
      // Handle both wrapped and direct input formats
      const inputData = context.df.getInput() as any;
      let message: string, sessionId: string;
      
      if (inputData.input && inputData.input.message) {
        // Input is wrapped in an 'input' property (from createChatEndpoint)
        console.log(`[ORCHESTRATOR] 📥 Using wrapped input format`);
        ({ message, sessionId } = inputData.input);
      } else if (inputData.message) {
        // Direct input format
        console.log(`[ORCHESTRATOR] 📥 Using direct input format`);
        ({ message, sessionId } = inputData);
      } else {
        console.error(`[ORCHESTRATOR] ❌ Invalid input format:`, inputData);
        throw new Error(`Invalid input format: ${JSON.stringify(inputData)}`);
      }
      
      console.log(`[ORCHESTRATOR] 🚀 EXECUTING WORKFLOW for session: ${sessionId}`);
      console.log(`[ORCHESTRATOR] 💬 Processing message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      context.df.setCustomStatus(`Processing: "${message.substring(0, 50)}..."`);
      
      const entityId = new df.EntityId('conversationEntity', sessionId);
      
      try {
        // Step 1: Store user message
        console.log(`[ORCHESTRATOR] 📝 Step 1: Storing user message in entity`);
        yield context.df.callEntity(entityId, 'addMessage', { role: 'user', content: message });
        
        // Step 2: Process with Azure Foundry OpenAI (THIS IS THE CRITICAL STEP)
        console.log(`[ORCHESTRATOR] 🤖 Step 2: Calling processChatActivity`);
        const response = yield context.df.callActivity('processChatActivity', { message, sessionId });
        console.log(`[ORCHESTRATOR] 📨 Got response from activity: ${response.length} chars`);
        
        // Step 3: Store assistant response  
        console.log(`[ORCHESTRATOR] 💾 Step 3: Storing assistant response in entity`);
        yield context.df.callEntity(entityId, 'addMessage', { role: 'assistant', content: response });
        
        context.df.setCustomStatus(`Completed successfully`);
        console.log(`[ORCHESTRATOR] ✅ WORKFLOW COMPLETED for session: ${sessionId}`);
        return { success: true, response, sessionId };
        
      } catch (error) {
        context.df.setCustomStatus(`Failed: ${error}`);
        console.error(`[ORCHESTRATOR] ❌ WORKFLOW FAILED for session ${sessionId}:`, error);
        throw error;
      }
    });

    // Register the activity (THIS IS WHERE executeOpenAIChat GETS CALLED)
    console.log(`[SETUP] ⚙️ Registering processChatActivity`);
    df.app.activity('processChatActivity', {
      handler: async (input: { message: string; sessionId: string }): Promise<string> => {
        console.log(`[ACTIVITY]   STARTING processChatActivity for session: ${input.sessionId}`);
        console.log(`[ACTIVITY] 📝 Message to process: "${input.message.substring(0, 100)}..."`);
        
        try {
          if (!AzureFoundryAgentOrchestrator.instance) {
            console.error(`[ACTIVITY] ❌ No orchestrator instance available!`);
            throw new Error('Orchestrator instance not available');
          }
          
          console.log(`[ACTIVITY] 🤖 Calling executeOpenAIChat method...`);
          const response = await AzureFoundryAgentOrchestrator.instance.executeOpenAIChat(input.message);
          console.log(`[ACTIVITY] ✅ executeOpenAIChat completed! Response: ${response.length} chars`);
          console.log(`[ACTIVITY] 📤 Returning response: "${response.substring(0, 100)}..."`);
          return response;
          
        } catch (error) {
          console.error(`[ACTIVITY] ❌ processChatActivity FAILED:`, error);
          throw new Error(`Activity processing failed: ${error}`);
        }
      }
    });

    console.log(`[SETUP] ✅ Durable functions registered successfully`);
  }

  /**
   * Static method to register the conversation entity at module load time
   */
  static registerConversationEntity(): void {
    console.log(`[SETUP] 📝 Registering conversationEntity`);
    df.app.entity('conversationEntity', (context) => {
      const state: ConversationState = context.df.getState(() => ({
        chatHistory: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      })) as ConversationState;

      const operation = context.df.operationName;
      
      const operations = {
        'addMessage': () => {
          const input = context.df.getInput() as { role: 'user' | 'assistant' | 'system'; content: string };
          console.log(`[ENTITY] ➕ Adding ${input.role} message (${input.content.length} chars)`);
          state.chatHistory.push({
            role: input.role,
            content: input.content,
            timestamp: new Date().toISOString()
          });
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          console.log(`[ENTITY] ✅ Total messages: ${state.chatHistory.length}`);
          return { success: true };
        },
        'getState': () => {
          console.log(`[ENTITY] 📊 Getting state - ${state.chatHistory.length} messages`);
          return {
            messageCount: state.chatHistory.length,
            createdAt: state.createdAt,
            lastUpdated: state.lastUpdated,
            recentMessages: state.chatHistory.slice(-5)
          };
        },
        'getFullHistory': () => {
          console.log(`[ENTITY] 📚 Getting full history - ${state.chatHistory.length} messages`);
          return state.chatHistory;
        },
        'clearHistory': () => {
          const clearedCount = state.chatHistory.length;
          console.log(`[ENTITY] 🧹 Clearing ${clearedCount} messages`);
          state.chatHistory = [];
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          return { success: true, clearedCount };
        }
      };

      const result = operations[operation] ? operations[operation]() : state;
      console.log(`[ENTITY] 🔄 Operation '${operation}' completed`);
      return result;
    });
  }

  /**
   * Generate a GUID (Globally Unique Identifier)
   * @returns A GUID string
   */
  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Execute Azure Foundry OpenAI chat with tool calling support
   * @param message User message to process
   * @returns AI response
   */
  public async executeOpenAIChat(message: string): Promise<string> {
    console.log(`[AZURE-FOUNDRY] 🚀 Processing: "${message.substring(0, 50)}..."`);
    
    try {
      const response = await this.azureOpenAI.chat.completions.create({
        model: this.config.deploymentName,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          { role: 'user', content: message }
        ],
        tools: this.toolRegistry.getAzureOpenAISchema(),
        tool_choice: 'auto',
        temperature: this.config.temperature || 0.7,
        max_tokens: 2000
      });

      const completion = response.choices[0];
      console.log(`[AZURE-FOUNDRY] 📝 Tool calls requested: ${completion.message.tool_calls?.length || 0}`);

      if (completion.message.tool_calls && completion.message.tool_calls.length > 0) {
        console.log(`[AZURE-FOUNDRY] 🔧 Processing ${completion.message.tool_calls.length} tool call(s)`);
        const toolResults = [];
        
        for (const toolCall of completion.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          try {
            console.log(`[TOOL] 🔧 Executing: ${toolName}`);
            const toolResult = await this.toolRegistry.executeTool(toolName, toolArgs);
            console.log(`[TOOL] ✅ ${toolName} completed successfully`);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: toolResult
            });
          } catch (error) {
            console.error(`[TOOL] ❌ ${toolName} failed:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: `Error executing ${toolName}: ${error}`
            });
          }
        }

        // Get final response with tool results
        const finalResponse = await this.azureOpenAI.chat.completions.create({
          model: this.config.deploymentName,
          messages: [
            { role: 'system', content: this.config.systemPrompt },
            { role: 'user', content: message },
            completion.message,
            ...toolResults
          ],
          temperature: this.config.temperature || 0.7,
          max_tokens: 2000
        });

        const finalResult = finalResponse.choices[0].message.content || 'No response generated';
        console.log(`[AZURE-FOUNDRY] ✅ Final response: "${finalResult.substring(0, 50)}..."`);
        return finalResult;
      } else {
        const directResult = completion.message.content || 'No response generated';
        console.log(`[AZURE-FOUNDRY] ✅ Direct response: "${directResult.substring(0, 50)}..."`);
        return directResult;
      }
    } catch (error) {
      console.error(`[AZURE-FOUNDRY] ❌ Chat failed:`, error);
      throw new Error(`Azure Foundry OpenAI processing failed: ${error}`);
    }
  }

  /**
   * Create HTTP endpoint for chatting with the agent
   * @param route HTTP route pattern (default: 'agent/chat/{sessionId?}')
   * @param functionName Function name (auto-generated based on agent name)
   */
  createChatEndpoint(route: string = 'agent/chat/{sessionId?}', functionName?: string): void {
    const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    functionName = functionName || `chatWith${this.config.name.replace(/[^a-zA-Z0-9]/g, '')}Agent`;
    app.http(functionName, {
      methods: ['POST'],
      route: route,
      authLevel: 'anonymous',
      extraInputs: [df.input.durableClient()],
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const startTime = Date.now();
        
        try {
          console.log(`[HTTP] 📨 Chat request from ${request.headers.get('user-agent') || 'unknown'}`);
          
          const body = await request.json() as any;
          const message = body?.message || body?.prompt || 'Hello';
          
          // Generate session ID - use provided sessionId as-is or create new one
          let sessionId: string;
          if (body?.sessionId) {
            // Use provided sessionId from JSON body as-is
            sessionId = body.sessionId;
          } else if (request.params.sessionId) {
            // Use URL parameter sessionId as-is
            sessionId = request.params.sessionId;
          } else {
            // Generate completely new session ID
            sessionId = `session-${this.generateGuid()}`;
          }
          
          console.log(`[HTTP] 💬 "${message.substring(0, 50)}..." → Session: ${sessionId}`);
          
          const client = df.getClient(context);
          console.log(`[HTTP] 🚀 Starting orchestrator: chatOrchestrator`);
          
          // Start orchestrator in background and return immediately
          const instanceId = await client.startNew('chatOrchestrator', {
            input: { message, sessionId }
          });
          
          console.log(`[HTTP] 🔄 Orchestrator started in background: ${instanceId}`);
          console.log(`[HTTP] ✅ Request completed immediately, processing continues in background`);
          
          // Generate endpoints
          const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const stateEndpoint = `/api/${agentId}/state/${sessionId}`;
          const healthEndpoint = `/api/${agentId}/health`;
          const orchestratorStatusEndpoint = `/api/${agentId}/orchestrator/${instanceId}`;
          const processingTime = Date.now() - startTime;
          
          // Return immediately with 202 status (background processing started)
          return {
            status: 202,
            jsonBody: {
              success: true,
              message: 'Azure Foundry chat processing started in background',
              sessionId,
              instanceId,
              status: 'processing',
              endpoints: {
                state: stateEndpoint,
                health: healthEndpoint,
                orchestratorStatus: orchestratorStatusEndpoint
              },
              azure: {
                foundryEndpoint: this.config.endpoint || 'Using environment default',
                deployment: this.config.deploymentName,
                apiVersion: this.config.apiVersion || '2024-10-21'
              },
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };
          
        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Chat failed after ${processingTime}ms:`, error);
          
          return {
            status: 500,
            jsonBody: {
              success: false,
              error: String(error),
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };
        }
      }
    });
  }

  /**
   * Create HTTP endpoint for getting conversation state
   * @param route HTTP route pattern (default: 'agent/state/{sessionId}')
   * @param functionName Function name (auto-generated based on agent name)
   */
  createStateEndpoint(route: string = 'agent/state/{sessionId}', functionName?: string): void {
    functionName = functionName || `get${this.config.name.replace(/[^a-zA-Z0-9]/g, '')}AgentState`;
    app.http(functionName, {
      methods: ['GET'],
      route: route,
      authLevel: 'anonymous',
      extraInputs: [df.input.durableClient()],
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const startTime = Date.now();
        
        try {
          const sessionId = request.params.sessionId;
          console.log(`[HTTP] 📊 State request for session: ${sessionId}`);
          
          if (!sessionId) {
            return {
              status: 400,
              jsonBody: {
                success: false,
                error: 'sessionId is required',
                timestamp: new Date().toISOString()
              }
            };
          }

          const client = df.getClient(context);
          const entityId = new df.EntityId('conversationEntity', sessionId);
          const stateResponse = await client.readEntityState(entityId);
          
          if (!stateResponse.entityExists) {
            return {
              status: 404,
              jsonBody: {
                success: false,
                error: 'Session not found',
                sessionId,
                timestamp: new Date().toISOString()
              }
            };
          }

          const state = stateResponse.entityState as ConversationState;
          const processingTime = Date.now() - startTime;
          
          console.log(`[HTTP] ✅ State retrieved in ${processingTime}ms. Messages: ${state.chatHistory.length}`);
          
          return {
            status: 200,
            jsonBody: {
              success: true,
              sessionId,
              messageCount: state.chatHistory.length,
              createdAt: state.createdAt,
              lastUpdated: state.lastUpdated,
              recentMessages: state.chatHistory.slice(-5),
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Get state failed after ${processingTime}ms:`, error);
          
          return {
            status: 500,
            jsonBody: {
              success: false,
              error: String(error),
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };
        }
      }
    });
  }

  /**
   * Create health check endpoint
   * @param route HTTP route pattern (default: 'health')
   * @param functionName Function name (auto-generated based on agent name)
   */
  createHealthEndpoint(route: string = 'health', functionName?: string): void {
    functionName = functionName || `${this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}HealthCheck`;
    app.http(functionName, {
      methods: ['GET'],
      route: route,
      authLevel: 'anonymous',
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        console.log(`[HTTP] 💚 Health check from ${request.headers.get('user-agent') || 'unknown'}`);
        
        return {
          status: 200,
          jsonBody: {
            status: 'healthy',
            service: `${this.config.name} Agent`,
            version: '1.0.0',
            agent: {
              name: this.config.name,
              deployment: this.config.deploymentName,
              temperature: this.config.temperature || 0.7,
              availableTools: this.toolRegistry.getToolNames(),
              toolCount: this.toolRegistry.getToolCount(),
              toolsInfo: this.toolRegistry.getToolsInfo()
            },
            azure: {
              foundryEndpoint: this.config.endpoint || 'Using environment default',
              deployment: this.config.deploymentName,
              apiVersion: this.config.apiVersion || '2024-10-21',
              authMethod: 'Azure AD (Managed Identity)'
            },
            environment: {
              nodeVersion: process.version,
              platform: process.platform,
              azureFoundryConfigured: !!this.config.endpoint || !!process.env.AZURE_OPENAI_ENDPOINT
            },
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          }
        };
      }
    });
  }

  /**
   * Create orchestrator status endpoint for monitoring background processing
   * @param route HTTP route pattern (default: 'agent/orchestrator/{instanceId}')
   * @param functionName Function name (auto-generated based on agent name)
   */
  createOrchestratorStatusEndpoint(route: string = 'agent/orchestrator/{instanceId}', functionName?: string): void {
    functionName = functionName || `get${this.config.name.replace(/[^a-zA-Z0-9]/g, '')}OrchestratorStatus`;
    app.http(functionName, {
      methods: ['GET'],
      route: route,
      authLevel: 'anonymous',
      extraInputs: [df.input.durableClient()],
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const startTime = Date.now();
        
        try {
          const instanceId = request.params.instanceId;
          console.log(`[HTTP] 📊 Orchestrator status request for instance: ${instanceId}`);
          
          if (!instanceId) {
            return {
              status: 400,
              jsonBody: {
                success: false,
                error: 'instanceId is required',
                timestamp: new Date().toISOString()
              }
            };
          }

          const client = df.getClient(context);
          const status = await client.getStatus(instanceId);
          
          if (!status) {
            return {
              status: 404,
              jsonBody: {
                success: false,
                error: 'Orchestrator instance not found',
                instanceId,
                timestamp: new Date().toISOString()
              }
            };
          }

          const processingTime = Date.now() - startTime;
          
          console.log(`[HTTP] ✅ Status retrieved in ${processingTime}ms. Status: ${status.runtimeStatus}`);
          
          return {
            status: 200,
            jsonBody: {
              success: true,
              instanceId,
              runtimeStatus: status.runtimeStatus,
              customStatus: status.customStatus,
              output: status.output,
              createdTime: status.createdTime,
              lastUpdatedTime: status.lastUpdatedTime,
              input: status.input,
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Get orchestrator status failed after ${processingTime}ms:`, error);
          
          return {
            status: 500,
            jsonBody: {
              success: false,
              error: String(error),
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };
        }
      }
    });
  }

  /**
   * Run all durable functions and HTTP endpoints with default configuration for Azure Foundry
   */
  run(): void {
    console.log(`[AGENT] 🚀 Running ${this.config.name} with Azure Foundry OpenAI...`);
    
    const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Durable functions are registered statically at module load time
    console.log(`[AGENT] 📋 Durable functions already registered statically`);
    
    // Create HTTP endpoints
    this.createChatEndpoint(`${agentId}/chat/{sessionId?}`);
    this.createStateEndpoint(`${agentId}/state/{sessionId}`);
    this.createOrchestratorStatusEndpoint(`${agentId}/orchestrator/{instanceId}`);
    this.createHealthEndpoint(`${agentId}/health`);
    
    console.log(`[AGENT] ✅ ${this.config.name} ready with Azure Foundry OpenAI!`);
    console.log(`[AGENT] 📍 Chat: /api/${agentId}/chat/{sessionId}`);
    console.log(`[AGENT] 📊 Status: /api/${agentId}/orchestrator/{instanceId}`);
    console.log(`[AGENT] 🔍 State: /api/${agentId}/state/{sessionId}`);
    console.log(`[AGENT] 💚 Health: /api/${agentId}/health`);
  }
}