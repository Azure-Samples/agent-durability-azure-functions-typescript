/**
 * Human-in-the-Loop Durable Functions Wrapper
 * 
 * This module extends the basic durable wrapper to support human approval workflows.
 * It allows AI agents to pause execution and wait for human input before proceeding.
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
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * Human approval constants
 */
export const HUMAN_APPROVAL_EVENT = 'HumanApproval';

/**
 * Human approval payload interface
 */
export interface HumanApprovalPayload {
  approved: boolean;
  feedback?: string;
}

/**
 * Human approval request interface
 */
export interface HumanApprovalRequest {
  sessionId: string;
  toolName: string;
  toolArgs: any;
  reasoning: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  humanResponse?: string;
  humanResponseTimestamp?: string;
}

/**
 * Entity state interface for conversation management with human approvals
 */
export interface ConversationState {
  chatHistory: ChatMessage[];
  pendingApprovals: HumanApprovalRequest[];
  createdAt: string;
  lastUpdated: string;
}

/**
 * Human-in-the-Loop Durable OpenAI Agent Wrapper
 * 
 * Extends the basic wrapper to support human approval workflows where
 * certain tool executions require human confirmation before proceeding.
 */
export class HumanInLoopDurableAgentOrchestrator {
  private openai: OpenAI;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;
  private humanApprovalTools: Set<string> = new Set();
  private entityName: string;
  private orchestratorName: string;
  private activityName: string;

  constructor(openaiApiKey: string, config: AgentConfig, toolRegistry: ToolRegistry) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.config = config;
    this.toolRegistry = toolRegistry;
    
    // Create unique names for this agent instance
    const agentId = config.name.replace(/[^a-zA-Z0-9]/g, '');
    this.entityName = `${agentId}ConversationEntity`;
    this.orchestratorName = `${agentId}ChatOrchestrator`;
    this.activityName = `${agentId}ProcessChatActivity`;
    
    console.log(`[AGENT] 🤖 Initializing Human-in-Loop ${config.name} with model ${config.model}`);
    console.log(`[AGENT] 🔧 Entity: ${this.entityName}, Orchestrator: ${this.orchestratorName}`);
    console.log(`[AGENT] 🛠️  Registered tools: ${toolRegistry.getToolNames().join(', ')}`);
  }

  /**
   * Mark specific tools as requiring human approval
   * @param toolNames Array of tool names that need human approval
   */
  setHumanApprovalTools(toolNames: string[]): void {
    this.humanApprovalTools = new Set(toolNames);
    console.log(`[AGENT] 👥 Human approval required for tools: ${toolNames.join(', ')}`);
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
   * Create and register the enhanced conversation entity with human approval support
   */
  createConversationEntity(): void {
    df.app.entity(this.entityName, (context) => {
      const state: ConversationState = context.df.getState(() => ({
        chatHistory: [],
        pendingApprovals: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      })) as ConversationState;

      const operation = context.df.operationName;
      console.log(`[ENTITY] 📝 Operation: ${operation}`);
      
      switch (operation) {
        case 'addMessage':
          const messageInput = context.df.getInput() as { role: 'user' | 'assistant' | 'system'; content: string };
          console.log(`[ENTITY] ➕ Adding ${messageInput.role} message: "${messageInput.content.substring(0, 50)}..."`);
          
          state.chatHistory.push({
            role: messageInput.role,
            content: messageInput.content,
            timestamp: new Date().toISOString()
          });
          
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          
          console.log(`[ENTITY] ✅ Message added. Total: ${state.chatHistory.length}`);
          return { success: true };

        case 'addApprovalRequest':
          const approvalInput = context.df.getInput() as {
            sessionId: string;
            toolName: string;
            toolArgs: any;
            reasoning: string;
          };
          
          const approvalRequest: HumanApprovalRequest = {
            sessionId: approvalInput.sessionId,
            toolName: approvalInput.toolName,
            toolArgs: approvalInput.toolArgs,
            reasoning: approvalInput.reasoning,
            timestamp: new Date().toISOString(),
            status: 'pending'
          };
          
          state.pendingApprovals.push(approvalRequest);
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          
          console.log(`[ENTITY] 👥 Added approval request for session: ${approvalRequest.sessionId}, tool: ${approvalInput.toolName}`);
          return { success: true, sessionId: approvalRequest.sessionId };

        case 'handleApproval':
          const approvalResponse = context.df.getInput() as {
            sessionId: string;
            decision: 'approved' | 'rejected';
            humanResponse?: string;
          };
          
          const approval = state.pendingApprovals.find(a => a.sessionId === approvalResponse.sessionId && a.status === 'pending');
          if (approval) {
            approval.status = approvalResponse.decision;
            approval.humanResponse = approvalResponse.humanResponse;
            approval.humanResponseTimestamp = new Date().toISOString();
            state.lastUpdated = new Date().toISOString();
            context.df.setState(state);
            
            console.log(`[ENTITY] ✅ Approval for session ${approvalResponse.sessionId} ${approvalResponse.decision}`);
            return { success: true, approval };
          } else {
            console.log(`[ENTITY] ❌ Approval for session ${approvalResponse.sessionId} not found`);
            return { success: false, error: 'Approval request not found' };
          }

        case 'getPendingApprovals':
          const pending = state.pendingApprovals.filter(a => a.status === 'pending');
          console.log(`[ENTITY] 👥 Retrieved ${pending.length} pending approvals`);
          return { approvals: pending };

        case 'getState':
          console.log(`[ENTITY] 📊 Retrieving state. Messages: ${state.chatHistory.length}, Pending: ${state.pendingApprovals.filter(a => a.status === 'pending').length}`);
          return {
            messageCount: state.chatHistory.length,
            pendingApprovalCount: state.pendingApprovals.filter(a => a.status === 'pending').length,
            createdAt: state.createdAt,
            lastUpdated: state.lastUpdated,
            recentMessages: state.chatHistory.slice(-5),
            pendingApprovals: state.pendingApprovals // Return ALL approvals, not just pending ones
          };
          
        case 'getFullHistory':
          console.log(`[ENTITY] 📚 Retrieving full history. Messages: ${state.chatHistory.length}`);
          return {
            chatHistory: state.chatHistory,
            approvalHistory: state.pendingApprovals
          };
          
        default:
          return state;
      }
    });
  }

  /**
   * Create simplified chat orchestrator with external event support
   */
  createChatOrchestrator(): void {
    const entityName = this.entityName;
    const humanApprovalTools = this.humanApprovalTools;
    const toolRegistry = this.toolRegistry;
    const openai = this.openai;
    const config = this.config;
    
    df.app.orchestration(this.orchestratorName, function* (context) {
      const input = context.df.getInput() as { message: string; sessionId: string; approvalTimeoutMinutes?: number };
      const { message, sessionId, approvalTimeoutMinutes = 30 } = input;
      
      console.log(`[ORCHESTRATOR] 🎭 Starting chat workflow for session: ${sessionId}`);
      context.df.setCustomStatus(`Processing: "${message.substring(0, 50)}..."`);
      
      const entityId = new df.EntityId(entityName, sessionId);
      
      try {
        // Step 1: Store user message
        yield context.df.callEntity(entityId, 'addMessage', { role: 'user', content: message });
        
        // Step 2: Get AI response with tool calls
        const response = yield context.df.callActivity('ProcessMessage', {
          message,
          systemPrompt: config.systemPrompt,
          model: config.model,
          temperature: config.temperature || 0.7,
          tools: toolRegistry.getOpenAISchema()
        });

        let finalResponse = response.content || 'No response generated';
        
        // Step 3: Handle tool calls that require approval
        if (response.tool_calls && response.tool_calls.length > 0) {
          for (const toolCall of response.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            if (humanApprovalTools.has(toolName)) {
              console.log(`[ORCHESTRATOR] 👥 Tool ${toolName} requires approval`);
              context.df.setCustomStatus(`Requesting approval for ${toolName}. Timeout: ${approvalTimeoutMinutes} min.`);
              
              // Create approval request using sessionId
              yield context.df.callEntity(entityId, 'addApprovalRequest', {
                sessionId,
                toolName,
                toolArgs,
                reasoning: `AI wants to execute ${toolName} with: ${JSON.stringify(toolArgs)}`
              });
              
              console.log(`[ORCHESTRATOR] ✅ Approval request created for session: ${sessionId}, tool: ${toolName}`);
              
              console.log(`[ORCHESTRATOR] 👥 Created approval request for session: ${sessionId}`);
              
              // Poll for approval decision with timeout
              const timeoutDate = new Date(context.df.currentUtcDateTime.getTime() + (approvalTimeoutMinutes * 60 * 1000));
              let approvalReceived = false;
              let humanDecision: { approved: boolean; feedback?: string } | null = null;
              
              // Poll every 5 seconds for approval decision
              while (!approvalReceived && context.df.currentUtcDateTime < timeoutDate) {
                // Wait 5 seconds before checking again
                const delay = new Date(context.df.currentUtcDateTime.getTime() + 5000);
                yield context.df.createTimer(delay);
                
                // Check if approval decision was made by getting the entity state
                const entityState = yield context.df.callEntity(entityId, 'getState');
                console.log(`[ORCHESTRATOR] 🔍 Entity state result:`, entityState);
                
                // Find our specific approval in the entity state
                let currentApproval: any = null;
                if (entityState?.pendingApprovals) {
                  currentApproval = entityState.pendingApprovals.find((a: any) => 
                    a.sessionId === sessionId && a.toolName === toolName && a.status !== 'pending'
                  );
                }
                
                if (currentApproval) {
                  approvalReceived = true;
                  humanDecision = {
                    approved: currentApproval.status === 'approved',
                    feedback: currentApproval.humanResponse || ''
                  };
                  console.log(`[ORCHESTRATOR] 👥 Received human decision: ${humanDecision.approved ? 'APPROVED' : 'REJECTED'}`);
                }
              }
              
              if (approvalReceived && humanDecision) {
                if (humanDecision.approved) {
                  context.df.setCustomStatus(`Executing approved tool: ${toolName}`);
                  const toolResult = yield context.df.callActivity('ExecuteTool', {
                    toolName,
                    toolArgs
                  });
                  finalResponse = `[HUMAN APPROVED] ${toolResult}`;
                } else {
                  finalResponse = `[HUMAN REJECTED] ${humanDecision.feedback || 'Operation was rejected'}`;
                }
              } else {
                // Timeout - mark as rejected
                console.log(`[ORCHESTRATOR] ⏰ Approval timed out after ${approvalTimeoutMinutes} minutes`);
                yield context.df.callEntity(entityId, 'handleApproval', {
                  sessionId: sessionId,
                  decision: 'rejected',
                  humanResponse: `Timeout after ${approvalTimeoutMinutes} minutes`
                });
                finalResponse = `[TIMEOUT] Request timed out after ${approvalTimeoutMinutes} minutes`;
              }
              
              // Return approval info for immediate response
              return { 
                success: true, 
                response: finalResponse,
                requiresApproval: true,
                sessionId: sessionId,
                toolName,
                toolArgs
              };
            } else {
              // Execute safe tools immediately
              const toolResult = yield context.df.callActivity('ExecuteTool', {
                toolName,
                toolArgs
              });
              finalResponse = toolResult;
            }
          }
        }
        
        // Step 4: Store final response
        yield context.df.callEntity(entityId, 'addMessage', { role: 'assistant', content: finalResponse });
        
        context.df.setCustomStatus(`Completed at ${new Date().toISOString()}`);
        return { success: true, response: finalResponse, requiresApproval: false };
        
      } catch (error) {
        context.df.setCustomStatus(`Failed: ${error}`);
        console.error(`[ORCHESTRATOR] ❌ Workflow failed:`, error);
        throw error;
      }
    });

    // Simplified activity functions
    df.app.activity('ProcessMessage', {
      handler: async (input: { 
        message: string;
        systemPrompt: string;
        model: string;
        temperature: number;
        tools: any[];
      }): Promise<any> => {
        console.log(`[ACTIVITY] 🔄 Processing message with OpenAI`);
        
        const response = await this.openai.chat.completions.create({
          model: input.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.message }
          ],
          tools: input.tools,
          tool_choice: 'auto',
          temperature: input.temperature
        });

        return response.choices[0].message;
      }
    });

    df.app.activity('ExecuteTool', {
      handler: async (input: { toolName: string; toolArgs: any }): Promise<string> => {
        console.log(`[ACTIVITY] 🔧 Executing tool: ${input.toolName}`);
        
        try {
          const result = await this.toolRegistry.executeTool(input.toolName, input.toolArgs);
          return result;
        } catch (error) {
          console.error(`[ACTIVITY] ❌ Tool ${input.toolName} failed:`, error);
          throw error;
        }
      }
    });
  }






  /**
   * Create HTTP endpoint for chatting with human-in-loop support
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
          console.log(`[HTTP] 📨 Human-in-loop chat request from ${request.headers.get('user-agent') || 'unknown'}`);
          
          const body = await request.json() as any;
          const message = body?.message || body?.prompt || 'Hello';
          
          // Generate session ID - use provided sessionId as-is or create new one
          let sessionId: string;
          if (body?.sessionId) {
            sessionId = body.sessionId;
          } else if (request.params.sessionId) {
            sessionId = request.params.sessionId;
          } else {
            sessionId = `session-${this.generateGuid()}`;
          }
          
          console.log(`[HTTP] 💬 "${message.substring(0, 50)}..." → Human-in-loop Session: ${sessionId}`);
          
          const client = df.getClient(context);
          const approvalTimeoutMinutes = body?.approvalTimeoutMinutes || 30;
          
          const instanceId = await client.startNew(this.orchestratorName, {
            input: { message, sessionId, approvalTimeoutMinutes }
          });
          
          // Wait a moment for orchestration to potentially return approval info
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check if orchestration completed with approval info
          const status = await client.getStatus(instanceId);
          const processingTime = Date.now() - startTime;
          
          console.log(`[HTTP] ✅ Started orchestrator ${instanceId} in ${processingTime}ms`);
          
          // Generate endpoint URLs using sessionId
          const approveEndpoint = `/api/${agentId}/approve/${sessionId}`;
          const statusEndpoint = `/api/${agentId}/status/${sessionId}`;
          
          // Check if we have approval info from orchestration
          const output = status?.output as any;
          if (output && output.requiresApproval && output.sessionId) {
            return {
              status: 200,
              jsonBody: {
                success: true,
                message: 'Human approval required for this operation.',
                sessionId,
                requiresApproval: true,
                toolName: output.toolName,
                toolArgs: output.toolArgs,
                approveEndpoint,
                statusEndpoint,
                approvalTimeoutMinutes,
                timestamp: new Date().toISOString(),
                processingTimeMs: processingTime
              }
            };
          } else {
            return {
              status: 202,
              jsonBody: {
                success: true,
                message: 'Chat processing started.',
                sessionId,
                requiresApproval: false,
                approveEndpoint,
                statusEndpoint,
                approvalTimeoutMinutes,
                timestamp: new Date().toISOString(),
                processingTimeMs: processingTime
              }
            };
          }
          
        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Human-in-loop chat failed after ${processingTime}ms:`, error);
          
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
   * Create HTTP endpoint for approval decisions (MAIN APPROVAL ENDPOINT)
   */
  createApprovalBySessionEndpoint(route: string = 'agent/approve/{sessionId}', functionName?: string): void {
    functionName = functionName || `approve${this.config.name.replace(/[^a-zA-Z0-9]/g, '')}BySession`;
    
    app.http(functionName, {
      methods: ['POST'],
      route: route,
      authLevel: 'anonymous',
      extraInputs: [df.input.durableClient()],
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const startTime = Date.now();
        
        try {
          const sessionId = request.params.sessionId;
          console.log(`[HTTP] 👥 Approval decision for session: ${sessionId}`);
          
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

          const body = await request.json() as any;
          const { approved, feedback } = body;
          
          if (typeof approved !== 'boolean') {
            return {
              status: 400,
              jsonBody: {
                success: false,
                error: 'approved field must be true or false',
                example: { approved: true, feedback: "Optional feedback message" },
                timestamp: new Date().toISOString()
              }
            };
          }

          const client = df.getClient(context);
          
          // Find active orchestration for this session
          // For simplicity, we'll use sessionId as the entity key to raise events
          const entityId = new df.EntityId(this.entityName, sessionId);
          
          // Store the approval decision in the entity
          await client.signalEntity(entityId, 'handleApproval', {
            sessionId,
            decision: approved ? 'approved' : 'rejected',
            humanResponse: feedback || ''
          });
          
          // Also raise external event to any running orchestrations for this session
          // We need to find the instanceId for the session - this is a limitation we'll work around
          // For now, we'll signal the entity and the orchestration should check the entity state
          
          const processingTime = Date.now() - startTime;
          console.log(`[HTTP] ✅ Stored approval decision for session ${sessionId}: ${approved ? 'APPROVED' : 'REJECTED'} in ${processingTime}ms`);
          
          return {
            status: 200,
            jsonBody: {
              success: true,
              message: 'Human approval stored for session.',
              sessionId,
              approved,
              feedback: feedback || '',
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Approval storage failed after ${processingTime}ms:`, error);
          
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
   * Create HTTP endpoint for getting session status
   */
  createSessionStatusEndpoint(route: string = 'agent/status/{sessionId}', functionName?: string): void {
    functionName = functionName || `get${this.config.name.replace(/[^a-zA-Z0-9]/g, '')}SessionStatus`;
    
    app.http(functionName, {
      methods: ['GET'],
      route: route,
      authLevel: 'anonymous',
      extraInputs: [df.input.durableClient()],
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const startTime = Date.now();
        
        try {
          const sessionId = request.params.sessionId;
          console.log(`[HTTP] 📊 Status request for session: ${sessionId}`);
          
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
          
          // Get status from entity
          const entityState = await client.readEntityState(entityId);
          
          if (!entityState.entityExists) {
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

          const processingTime = Date.now() - startTime;
          console.log(`[HTTP] ✅ Session status retrieved in ${processingTime}ms`);
          
          return {
            status: 200,
            jsonBody: {
              success: true,
              sessionId,
              entityState: entityState.entityState,
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Get session status failed after ${processingTime}ms:`, error);
          
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
   * Run all durable functions and HTTP endpoints with human-in-loop configuration
   */
  run(): void {
    console.log(`[AGENT] 🚀 Running ${this.config.name} with human-in-loop durable functions...`);
    
    const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    this.createConversationEntity();
    this.createChatOrchestrator();
    this.createChatEndpoint(`${agentId}/chat/{sessionId?}`);
    this.createApprovalBySessionEndpoint(`${agentId}/approve/{sessionId}`);
    this.createSessionStatusEndpoint(`${agentId}/status/{sessionId}`);
    
    console.log(`[AGENT] ✅ ${this.config.name} Human-in-Loop Agent is now running successfully!`);
    console.log(`[AGENT] 📍 Essential Endpoints:`);
    console.log(`[AGENT]    💬 Chat: POST /api/${agentId}/chat/{sessionId}`);
    console.log(`[AGENT]    ✅ Approve: POST /api/${agentId}/approve/{sessionId}`);
    console.log(`[AGENT]    📈 Status: GET /api/${agentId}/status/{sessionId}`);
  }
}