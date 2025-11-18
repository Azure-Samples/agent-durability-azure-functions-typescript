/**
 * Durable Agent Orchestrator
 * 
 * This module orchestrates the creation and management of Azure Durable Functions
 * for building AI agents with persistent conversation state. It coordinates
 * entities, orchestrators, activities, and HTTP endpoints for complete agent lifecycle.
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import OpenAI from 'openai';
import { ToolRegistry } from './Tool';

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  name: string;
  model: string;
  temperature?: number;
  systemPrompt: string;
}

/**
 * Chat message interface
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
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
 * Durable OpenAI Agent Orchestrator
 * 
 * Orchestrates the creation and management of AI agents with durable state management.
 * Coordinates multiple agents in the same function app by creating unique
 * durable function names based on the agent name.
 */
export class DurableOpenAiAgentOrchestrator {
  private openai: OpenAI;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;
  private entityName: string;
  private orchestratorName: string;
  private activityName: string;

  constructor(openaiApiKey: string, config: AgentConfig, toolRegistry: ToolRegistry) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.config = config;
    this.toolRegistry = toolRegistry;
    
    // Create unique names for this agent instance to support multi-agent scenarios
    const agentId = config.name.replace(/[^a-zA-Z0-9]/g, ''); // Remove special chars
    this.entityName = `${agentId}ConversationEntity`;
    this.orchestratorName = `${agentId}ChatOrchestrator`;
    this.activityName = `${agentId}ProcessChatActivity`;
    
    console.log(`[AGENT] 🤖 ${config.name} initialized with ${config.model} | Tools: ${toolRegistry.getToolNames().join(', ')}`);
  }

  /**
   * Create and register the durable entity for conversation state management
   */
  createConversationEntity(): void {
    df.app.entity(this.entityName, (context) => {
      const state: ConversationState = context.df.getState(() => ({
        chatHistory: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      })) as ConversationState;

      const operation = context.df.operationName;
      console.log(`[ENTITY] 📝 Operation: ${operation}`);
      
      switch (operation) {
        case 'addMessage':
          const input = context.df.getInput() as { role: 'user' | 'assistant'; content: string };
          console.log(`[ENTITY] ➕ Adding ${input.role} message: "${input.content.substring(0, 50)}..."`);
          
          state.chatHistory.push({
            role: input.role,
            content: input.content,
            timestamp: new Date().toISOString()
          });
          
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          
          console.log(`[ENTITY] ✅ Message added. Total: ${state.chatHistory.length}`);
          return { success: true };
          
        case 'getState':
          console.log(`[ENTITY] 📊 Retrieving state. Messages: ${state.chatHistory.length}`);
          return {
            messageCount: state.chatHistory.length,
            createdAt: state.createdAt,
            lastUpdated: state.lastUpdated,
            recentMessages: state.chatHistory.slice(-5)
          };
          
        case 'getFullHistory':
          console.log(`[ENTITY] 📚 Retrieving full history. Messages: ${state.chatHistory.length}`);
          return state.chatHistory;
          
        default:
          return state;
      }
    });
  }

  /**
   * Create and register the chat orchestrator
   */
  createChatOrchestrator(): void {
    const entityName = this.entityName;
    const activityName = this.activityName;
    
    df.app.orchestration(this.orchestratorName, function* (context) {
      const input = context.df.getInput() as { message: string; sessionId: string };
      const { message, sessionId } = input;
      
      console.log(`[ORCHESTRATOR] 🎭 Starting chat workflow for session: ${sessionId}`);
      
      const entityId = new df.EntityId(entityName, sessionId);
      
      try {
        // Step 1: Store user message
        yield context.df.callEntity(entityId, 'addMessage', { role: 'user', content: message });
        
        // Step 2: Process with AI
        const response = yield context.df.callActivity(activityName, message);
        
        // Step 3: Store assistant response  
        yield context.df.callEntity(entityId, 'addMessage', { role: 'assistant', content: response });
        
        console.log(`[ORCHESTRATOR] ✅ Chat workflow completed for session: ${sessionId}`);
        return { success: true, response };
        
      } catch (error) {
        console.error(`[ORCHESTRATOR] ❌ Workflow failed for session ${sessionId}:`, error);
        throw error;
      }
    });

    df.app.activity(this.activityName, {
      handler: async (message: string): Promise<string> => {
        console.log(`[ACTIVITY] 🔄 Processing message: "${message.substring(0, 50)}..."`);
        
        try {
          const response = await this.executeOpenAIChat(message);
          console.log(`[ACTIVITY] ✅ Message processed successfully`);
          return response;
          
        } catch (error) {
          console.error(`[ACTIVITY] ❌ Processing failed:`, error);
          throw error;
        }
      }
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
   * Execute OpenAI chat with tool calling support
   * @param message User message to process
   * @returns AI response
   */
  private async executeOpenAIChat(message: string): Promise<string> {
    console.log(`[OPENAI] 🚀 Processing: "${message.substring(0, 50)}..."`);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          { role: 'user', content: message }
        ],
        tools: this.toolRegistry.getOpenAISchema(),
        tool_choice: 'auto',
        temperature: this.config.temperature || 0.7
      });

      const completion = response.choices[0];
      console.log(`[OPENAI] 📝 Tool calls requested: ${completion.message.tool_calls?.length || 0}`);

      if (completion.message.tool_calls && completion.message.tool_calls.length > 0) {
        console.log(`[OPENAI] 🔧 Processing ${completion.message.tool_calls.length} tool call(s)`);
        const toolResults = [];
        
        for (const toolCall of completion.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          try {
            const toolResult = await this.toolRegistry.executeTool(toolName, toolArgs);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: toolResult
            });
          } catch (error) {
            console.error(`[OPENAI] ❌ Tool ${toolName} failed:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool' as const,
              content: `Error executing ${toolName}: ${error}`
            });
          }
        }

        // Get final response with tool results
        const finalResponse = await this.openai.chat.completions.create({
          model: this.config.model,
          messages: [
            { role: 'system', content: this.config.systemPrompt },
            { role: 'user', content: message },
            completion.message,
            ...toolResults
          ],
          temperature: this.config.temperature || 0.7
        });

        const finalResult = finalResponse.choices[0].message.content || 'No response generated';
        console.log(`[OPENAI] ✅ Final response: "${finalResult.substring(0, 50)}..."`);
        return finalResult;
      } else {
        const directResult = completion.message.content || 'No response generated';
        console.log(`[OPENAI] ✅ Direct response: "${directResult.substring(0, 50)}..."`);
        return directResult;
      }
    } catch (error) {
      console.error(`[OPENAI] ❌ Chat failed:`, error);
      throw new Error(`OpenAI processing failed: ${error}`);
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
          const instanceId = await client.startNew(this.orchestratorName, {
            input: { message, sessionId }
          });
          
          console.log(`[HTTP] ⏳ Waiting for orchestrator ${instanceId} to complete...`);
          
          console.log(`[HTTP] ✅ Started orchestrator ${instanceId} in ${Date.now() - startTime}ms`);
          
          // Generate state endpoint URL  
          const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const stateEndpoint = `/api/${agentId}/state/${sessionId}`;
          
          // Wait for orchestrator to complete and get result
          try {
            const orchestrationStatus = await client.getStatus(instanceId);
            if (orchestrationStatus?.output) {
              const result = orchestrationStatus.output as { success: boolean; response?: string };
              const processingTime = Date.now() - startTime;
              console.log(`[HTTP] ✅ Chat completed in ${processingTime}ms`);
              
              return {
                status: 200,
                jsonBody: {
                  success: true,
                  message: result.response || 'Chat completed',
                  sessionId,
                  instanceId,
                  stateEndpoint,
                  timestamp: new Date().toISOString(),
                  processingTimeMs: processingTime
                }
              };
            } else {
              // Still processing or no result yet
              const processingTime = Date.now() - startTime;
              return {
                status: 202,
                jsonBody: {
                  success: true,
                  message: 'Chat processing started',
                  sessionId,
                  instanceId,
                  stateEndpoint,
                  timestamp: new Date().toISOString(),
                  processingTimeMs: processingTime
                }
              };
            }
          } catch (statusError) {
            // Fallback to async processing
            const processingTime = Date.now() - startTime;
            console.log(`[HTTP] ⚡ Async processing for ${instanceId} in ${processingTime}ms`);
            
            return {
              status: 202,
              jsonBody: {
                success: true,
                message: 'Chat processing started',
                sessionId,
                instanceId,
                stateEndpoint,
                timestamp: new Date().toISOString(),
                processingTimeMs: processingTime
              }
            };
          }
          
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
          const entityId = new df.EntityId(this.entityName, sessionId);
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
              model: this.config.model,
              temperature: this.config.temperature || 0.7,
              availableTools: this.toolRegistry.getToolNames(),
              toolCount: this.toolRegistry.getToolCount()
            },
            environment: {
              nodeVersion: process.version,
              platform: process.platform,
              openaiConfigured: !!this.openai.apiKey
            },
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          }
        };
      }
    });
  }

  /**
   * Run all durable functions and HTTP endpoints with default configuration
   */
  run(): void {
    console.log(`[AGENT] 🚀 Running ${this.config.name} with durable functions...`);
    
    const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    this.createConversationEntity();
    this.createChatOrchestrator();
    this.createChatEndpoint(`${agentId}/chat/{sessionId?}`);
    this.createStateEndpoint(`${agentId}/state/{sessionId}`);
    this.createHealthEndpoint(`${agentId}/health`);
    
    console.log(`[AGENT] ✅ ${this.config.name} is now running successfully!`);
  }
}