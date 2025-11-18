// Orchestration constants for human approval
export const HUMAN_APPROVAL_EVENT = 'HumanApproval';
export const APPROVAL_TIMEOUT_HOURS = 72;

// Data models
export interface ToolExecutionInput {
  toolName: string;
  toolArgs: any;
  sessionId: string;
  userMessage: string;
  maxApprovalAttempts?: number;
  approvalTimeoutHours?: number;
}

export interface HumanApproval {
  approved: boolean;
  feedback?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
}