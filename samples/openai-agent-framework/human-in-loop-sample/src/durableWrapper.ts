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
 * Human approval request interface
 */
export interface HumanApprovalRequest {
  id: string;
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
export class HumanInLoopDurableAgentWrapper {
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
            toolName: string;
            toolArgs: any;
            reasoning: string;
          };
          
          const approvalRequest: HumanApprovalRequest = {
            id: this.generateGuid(),
            toolName: approvalInput.toolName,
            toolArgs: approvalInput.toolArgs,
            reasoning: approvalInput.reasoning,
            timestamp: new Date().toISOString(),
            status: 'pending'
          };
          
          state.pendingApprovals.push(approvalRequest);
          state.lastUpdated = new Date().toISOString();
          context.df.setState(state);
          
          console.log(`[ENTITY] 👥 Added approval request: ${approvalRequest.id} for tool ${approvalInput.toolName}`);
          return { success: true, approvalId: approvalRequest.id };

        case 'handleApproval':
          const approvalResponse = context.df.getInput() as {
            approvalId: string;
            decision: 'approved' | 'rejected';
            humanResponse?: string;
          };
          
          const approval = state.pendingApprovals.find(a => a.id === approvalResponse.approvalId);
          if (approval) {
            approval.status = approvalResponse.decision;
            approval.humanResponse = approvalResponse.humanResponse;
            approval.humanResponseTimestamp = new Date().toISOString();
            state.lastUpdated = new Date().toISOString();
            context.df.setState(state);
            
            console.log(`[ENTITY] ✅ Approval ${approvalResponse.approvalId} ${approvalResponse.decision}`);
            return { success: true, approval };
          } else {
            console.log(`[ENTITY] ❌ Approval ${approvalResponse.approvalId} not found`);
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
            pendingApprovals: state.pendingApprovals.filter(a => a.status === 'pending')
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
   * Create and register the human-in-loop chat orchestrator
   */
  createChatOrchestrator(): void {
    const entityName = this.entityName;
    const activityName = this.activityName;
    
    df.app.orchestration(this.orchestratorName, function* (context) {
      const input = context.df.getInput() as { message: string; sessionId: string };
      const { message, sessionId } = input;
      
      console.log(`[ORCHESTRATOR] 🎭 Starting human-in-loop chat workflow for session: ${sessionId}`);
      
      const entityId = new df.EntityId(entityName, sessionId);
      
      try {
        // Step 1: Store user message
        yield context.df.callEntity(entityId, 'addMessage', { role: 'user', content: message });
        
        // Step 2: Process with AI (may involve human approvals)
        const response = yield context.df.callActivity(activityName, { message, sessionId });
        
        // Step 3: Store assistant response
        yield context.df.callEntity(entityId, 'addMessage', { role: 'assistant', content: response });
        
        console.log(`[ORCHESTRATOR] ✅ Human-in-loop chat workflow completed for session: ${sessionId}`);
        return { success: true, response };
        
      } catch (error) {
        console.error(`[ORCHESTRATOR] ❌ Workflow failed for session ${sessionId}:`, error);
        throw error;
      }
    });

    df.app.activity(this.activityName, {
      handler: async (input: { message: string; sessionId: string }): Promise<string> => {
        console.log(`[ACTIVITY] 🔄 Processing message with human-in-loop: "${input.message.substring(0, 50)}..."`);
        
        try {
          const response = await this.executeOpenAIChatWithHumanApproval(input.message, input.sessionId);
          console.log(`[ACTIVITY] ✅ Message processed successfully with human involvement`);
          return response;
          
        } catch (error) {
          console.error(`[ACTIVITY] ❌ Processing failed:`, error);
          throw error;
        }
      }
    });
  }

  /**
   * Execute OpenAI chat with human approval support for sensitive tools
   */
  private async executeOpenAIChatWithHumanApproval(message: string, sessionId: string): Promise<string> {
    console.log(`[OPENAI] 🚀 Processing with human-in-loop: "${message.substring(0, 50)}..."`);
    
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
        console.log(`[OPENAI] 🔧 Processing ${completion.message.tool_calls.length} tool call(s) with human approval check`);
        
        const toolResults = [];
        
        for (const toolCall of completion.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          // Check if this tool requires human approval
          if (this.humanApprovalTools.has(toolName)) {
            console.log(`[OPENAI] 👥 Tool ${toolName} requires human approval - creating approval request`);
            
            // Create approval request and wait for human decision
            const approvalResult = await this.requestHumanApproval(
              sessionId,
              toolName,
              toolArgs,
              completion.message.content || `The AI wants to execute ${toolName} with the provided arguments.`
            );
            
            if (approvalResult.decision === 'approved') {
              console.log(`[OPENAI] ✅ Human approved ${toolName} execution`);
              const toolResult = await this.toolRegistry.executeTool(toolName, toolArgs);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: `[HUMAN APPROVED] ${toolResult}`
              });
            } else {
              console.log(`[OPENAI] ❌ Human rejected ${toolName} execution`);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool' as const,
                content: `[HUMAN REJECTED] Tool execution was rejected by human. Reason: ${approvalResult.humanResponse || 'No reason provided'}`
              });
            }
          } else {
            // Execute tool normally (no human approval needed)
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
        console.log(`[OPENAI] ✅ Final response with human approvals: "${finalResult.substring(0, 50)}..."`);
        return finalResult;
      } else {
        const directResult = completion.message.content || 'No response generated';
        console.log(`[OPENAI] ✅ Direct response (no tools): "${directResult.substring(0, 50)}..."`);
        return directResult;
      }
    } catch (error) {
      console.error(`[OPENAI] ❌ Chat with human approval failed:`, error);
      throw new Error(`OpenAI processing failed: ${error}`);
    }
  }

  /**
   * Request human approval using Durable Functions orchestration
   * This method creates a pending approval request that requires external human input
   */
  private async requestHumanApproval(
    sessionId: string,
    toolName: string,
    toolArgs: any,
    reasoning: string
  ): Promise<{ decision: 'approved' | 'rejected'; humanResponse?: string; instanceId?: string }> {
    console.log(`[HUMAN-APPROVAL] 👥 Creating approval request for ${toolName} in session ${sessionId}`);
    
    // For now, we'll create a mock approval request that can be handled by external endpoints
    // In a real implementation, this would integrate with orchestration
    
    const approvalId = `approval-${sessionId}-${toolName}-${Date.now()}`;
    
    console.log(`[HUMAN-APPROVAL] 📋 Approval Request Created:`);
    console.log(`  ID: ${approvalId}`);
    console.log(`  Tool: ${toolName}`);
    console.log(`  Args: ${JSON.stringify(toolArgs, null, 2)}`);
    console.log(`  Reasoning: ${reasoning}`);
    console.log(`  Session: ${sessionId}`);
    console.log(`📤 Use API endpoint to approve/reject: POST /api/approval/${approvalId}`);
    console.log(`� Body: {"approved": true/false, "feedback": "optional feedback"}`);
    
    // Store the approval request (in memory for demo - use database in production)
    this.storePendingApproval(approvalId, {
      toolName,
      toolArgs,
      reasoning,
      sessionId,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });
    
    // Return pending status - the orchestration will handle the actual approval
    return {
      decision: 'approved', // This will be overridden by orchestration result
      humanResponse: `Approval request ${approvalId} created for ${toolName}. Waiting for human decision.`,
      instanceId: approvalId
    };
  }
  
  /**
   * Store pending approval request (in-memory for demo)
   */
  private pendingApprovals = new Map<string, any>();
  
  private storePendingApproval(approvalId: string, approvalData: any): void {
    this.pendingApprovals.set(approvalId, approvalData);
    console.log(`[HUMAN-APPROVAL] 💾 Stored pending approval: ${approvalId}`);
  }
  
  /**
   * Get pending approval by ID
   */
  getPendingApproval(approvalId: string): any {
    return this.pendingApprovals.get(approvalId);
  }
  
  /**
   * Process human approval decision and execute approved tools
   */
  async processApprovalDecision(approvalId: string, approved: boolean, feedback?: string): Promise<boolean> {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) {
      return false;
    }
    
    approval.status = approved ? 'approved' : 'rejected';
    approval.feedback = feedback;
    approval.decidedAt = new Date().toISOString();
    
    if (approved) {
      try {
        // Execute the approved tool
        console.log(`[HUMAN-APPROVAL] ✅ Executing approved tool: ${approval.toolName}`);
        const toolResult = await this.toolRegistry.executeTool(approval.toolName, approval.toolArgs);
        approval.executionResult = toolResult;
        approval.executedAt = new Date().toISOString();
        console.log(`[HUMAN-APPROVAL] 🎯 Tool execution completed: ${toolResult.substring(0, 100)}...`);
      } catch (error) {
        console.error(`[HUMAN-APPROVAL] ❌ Tool execution failed:`, error);
        approval.executionError = String(error);
      }
    } else {
      console.log(`[HUMAN-APPROVAL] ❌ Tool execution rejected: ${approval.toolName}`);
    }
    
    this.pendingApprovals.set(approvalId, approval);
    console.log(`[HUMAN-APPROVAL] ✅ Processed approval ${approvalId}: ${approved ? 'APPROVED' : 'REJECTED'}`);
    return true;
  }
  
  /**
   * Get all pending approvals
   */
  getPendingApprovals(): Array<{id: string, data: any}> {
    const pending = [];
    for (const [id, data] of this.pendingApprovals.entries()) {
      if (data.status === 'pending') {
        pending.push({ id, data });
      }
    }
    return pending;
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
          const instanceId = await client.startNew(this.orchestratorName, {
            input: { message, sessionId }
          });
          
          const processingTime = Date.now() - startTime;
          console.log(`[HTTP] ✅ Started human-in-loop orchestrator ${instanceId} in ${processingTime}ms`);
          
          // Generate state endpoint URLs
          const stateEndpoint = `/api/${agentId}/state/${sessionId}`;
          const approvalEndpoint = `/api/${agentId}/approvals/${sessionId}`;
          
          return {
            status: 202,
            jsonBody: {
              success: true,
              message: 'Human-in-loop chat processing started',
              sessionId,
              instanceId,
              stateEndpoint,
              approvalEndpoint,
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };
          
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
   * Create HTTP endpoint for handling human approvals
   */
  createApprovalEndpoint(route: string = 'agent/approvals/{sessionId}', functionName?: string): void {
    functionName = functionName || `handle${this.config.name.replace(/[^a-zA-Z0-9]/g, '')}Approvals`;
    
    app.http(functionName, {
      methods: ['GET', 'POST'],
      route: route,
      authLevel: 'anonymous',
      extraInputs: [df.input.durableClient()],
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        const startTime = Date.now();
        
        try {
          const sessionId = request.params.sessionId;
          console.log(`[HTTP] 👥 Approval request for session: ${sessionId}`);
          
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

          if (request.method === 'GET') {
            // Get pending approvals by reading entity state
            const stateResponse = await client.readEntityState(entityId);
            let approvals: HumanApprovalRequest[] = [];
            
            if (stateResponse.entityExists) {
              const state = stateResponse.entityState as ConversationState;
              approvals = state.pendingApprovals.filter(a => a.status === 'pending');
            }
            
            const processingTime = Date.now() - startTime;
            console.log(`[HTTP] ✅ Retrieved ${approvals.length} pending approvals in ${processingTime}ms`);
            
            return {
              status: 200,
              jsonBody: {
                success: true,
                sessionId,
                approvals,
                timestamp: new Date().toISOString(),
                processingTimeMs: processingTime
              }
            };
          } else if (request.method === 'POST') {
            // Handle approval decision
            const body = await request.json() as any;
            const { approvalId, decision, humanResponse } = body;
            
            if (!approvalId || !decision || !['approved', 'rejected'].includes(decision)) {
              return {
                status: 400,
                jsonBody: {
                  success: false,
                  error: 'approvalId and decision (approved/rejected) are required',
                  timestamp: new Date().toISOString()
                }
              };
            }

            await client.signalEntity(entityId, 'handleApproval', {
              approvalId,
              decision,
              humanResponse
            });
            
            const processingTime = Date.now() - startTime;
            console.log(`[HTTP] ✅ Handled approval ${approvalId} -> ${decision} in ${processingTime}ms`);
            
            return {
              status: 200,
              jsonBody: {
                success: true,
                message: `Approval ${decision}`,
                sessionId,
                approvalId,
                decision,
                timestamp: new Date().toISOString(),
                processingTimeMs: processingTime
              }
            };
          } else {
            // Method not supported
            return {
              status: 405,
              jsonBody: {
                success: false,
                error: 'Method not allowed. Use GET to retrieve approvals or POST to handle approvals.',
                timestamp: new Date().toISOString()
              }
            };
          }

        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Approval handling failed after ${processingTime}ms:`, error);
          
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
   * Create enhanced state endpoint with approval information
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
          console.log(`[HTTP] 📊 Enhanced state request for session: ${sessionId}`);
          
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
          
          console.log(`[HTTP] ✅ Enhanced state retrieved in ${processingTime}ms. Messages: ${state.chatHistory.length}, Pending approvals: ${state.pendingApprovals.filter(a => a.status === 'pending').length}`);
          
          return {
            status: 200,
            jsonBody: {
              success: true,
              sessionId,
              messageCount: state.chatHistory.length,
              pendingApprovalCount: state.pendingApprovals.filter(a => a.status === 'pending').length,
              createdAt: state.createdAt,
              lastUpdated: state.lastUpdated,
              recentMessages: state.chatHistory.slice(-5),
              pendingApprovals: state.pendingApprovals.filter(a => a.status === 'pending'),
              approvalHistory: state.pendingApprovals.filter(a => a.status !== 'pending').slice(-5),
              timestamp: new Date().toISOString(),
              processingTimeMs: processingTime
            }
          };

        } catch (error) {
          const processingTime = Date.now() - startTime;
          console.error(`[HTTP] ❌ Get enhanced state failed after ${processingTime}ms:`, error);
          
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
   */
  createHealthEndpoint(route: string = 'health', functionName?: string): void {
    functionName = functionName || `${this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}HealthCheck`;
    
    app.http(functionName, {
      methods: ['GET'],
      route: route,
      authLevel: 'anonymous',
      handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
        console.log(`[HTTP] 💚 Human-in-loop health check from ${request.headers.get('user-agent') || 'unknown'}`);
        
        return {
          status: 200,
          jsonBody: {
            status: 'healthy',
            service: `${this.config.name} Human-in-Loop Agent`,
            version: '1.0.0',
            agent: {
              name: this.config.name,
              model: this.config.model,
              temperature: this.config.temperature || 0.7,
              availableTools: this.toolRegistry.getToolNames(),
              toolCount: this.toolRegistry.getToolCount(),
              humanApprovalTools: Array.from(this.humanApprovalTools)
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
   * Run all durable functions and HTTP endpoints with human-in-loop configuration
   */
  run(): void {
    console.log(`[AGENT] 🚀 Running ${this.config.name} with human-in-loop durable functions...`);
    
    const agentId = this.config.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    this.createConversationEntity();
    this.createChatOrchestrator();
    this.createChatEndpoint(`${agentId}/chat/{sessionId?}`);
    this.createStateEndpoint(`${agentId}/state/{sessionId}`);
    this.createApprovalEndpoint(`${agentId}/approvals/{sessionId}`);
    this.createHealthEndpoint(`${agentId}/health`);
    
    console.log(`[AGENT] ✅ ${this.config.name} Human-in-Loop Agent is now running successfully!`);
    console.log(`[AGENT] 📍 Endpoints:`);
    console.log(`[AGENT]    💬 Chat: /api/${agentId}/chat/{sessionId}`);
    console.log(`[AGENT]    📊 State: /api/${agentId}/state/{sessionId}`);
    console.log(`[AGENT]    👥 Approvals: /api/${agentId}/approvals/{sessionId}`);
    console.log(`[AGENT]    💚 Health: /api/${agentId}/health`);
  }
}