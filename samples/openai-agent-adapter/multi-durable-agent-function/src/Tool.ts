/**
 * Tool Definition Wrapper
 * 
 * This module provides a simple wrapper for defining AI tools that can be called by OpenAI.
 * It handles the boilerplate of creating both the function implementation and OpenAI schema.
 */

import OpenAI from 'openai';

/**
 * Tool parameter definition for OpenAI function calling
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

/**
 * Tool definition interface for easy tool creation
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  handler: (...args: any[]) => Promise<string>;
}

/**
 * Tool registry that manages all available tools
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a new tool with automatic logging
   * @param toolDef Tool definition object
   */
  registerTool(toolDef: ToolDefinition): void {
    console.log(`[TOOL] 🔧 Registering tool: ${toolDef.name}`);
    this.tools.set(toolDef.name, toolDef);
  }

  /**
   * Execute a tool by name with automatic logging and error handling
   * @param toolName Name of the tool to execute
   * @param args Arguments to pass to the tool
   * @returns Promise resolving to the tool's result
   */
  async executeTool(toolName: string, args: any): Promise<string> {
    console.log(`[TOOL] 🚀 Executing ${toolName} with args:`, args);
    
    const tool = this.tools.get(toolName);
    if (!tool) {
      const error = `Tool '${toolName}' not found in registry`;
      console.error(`[TOOL] ❌ ${error}`);
      throw new Error(error);
    }

    try {
      // Convert args object to array based on parameter order
      const paramNames = Object.keys(tool.parameters);
      const argArray = paramNames.map(paramName => args[paramName]);
      
      const startTime = Date.now();
      const result = await tool.handler(...argArray);
      const executionTime = Date.now() - startTime;
      
      console.log(`[TOOL] ✅ ${toolName} completed in ${executionTime}ms: "${result.substring(0, 100)}..."`);
      return result;
      
    } catch (error) {
      console.error(`[TOOL] ❌ ${toolName} failed:`, error);
      return `Error executing ${toolName}: ${error}`;
    }
  }

  /**
   * Get OpenAI function calling schema for all registered tools
   * @returns Array of OpenAI tool definitions
   */
  getOpenAISchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: Object.entries(tool.parameters).reduce((props, [name, param]) => {
            props[name] = {
              type: param.type,
              description: param.description
            };
            return props;
          }, {} as Record<string, any>),
          required: Object.entries(tool.parameters)
            .filter(([, param]) => param.required !== false)
            .map(([name]) => name)
        }
      }
    }));
  }

  /**
   * Get list of all registered tool names
   * @returns Array of tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   * @param toolName Name of the tool to check
   * @returns True if tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get count of registered tools
   * @returns Number of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }
}

/**
 * Helper function to create a tool definition with proper typing
 * @param definition Tool definition object
 * @returns The same tool definition (for fluent API)
 */
export function createTool(definition: ToolDefinition): ToolDefinition {
  return definition;
}

/**
 * Helper function to create tool parameters with proper typing
 * @param type Parameter type
 * @param description Parameter description
 * @param required Whether the parameter is required (default: true)
 * @returns Tool parameter definition
 */
export function createParameter(
  type: ToolParameter['type'], 
  description: string, 
  required: boolean = true
): ToolParameter {
  return { type, description, required };
}

/**
 * Global tool registry instance for easy access
 */
export const globalToolRegistry = new ToolRegistry();

/**
 * Convenience function to register a tool with the global registry
 * @param toolDef Tool definition to register
 */
export function registerTool(toolDef: ToolDefinition): void {
  globalToolRegistry.registerTool(toolDef);
}

/**
 * Convenience function to execute a tool from the global registry
 * @param toolName Name of the tool to execute
 * @param args Arguments to pass to the tool
 * @returns Promise resolving to the tool's result
 */
export function executeTool(toolName: string, args: any): Promise<string> {
  return globalToolRegistry.executeTool(toolName, args);
}