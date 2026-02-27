import { postQuery } from './client.js';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export const tools: ToolDef[] = [
  // 1. baden_start_task
  {
    name: 'baden_start_task',
    description:
      'Call when you receive a new user instruction. Returns a taskId to use in all subsequent baden_ calls for this task.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The original user instruction' },
      },
      required: ['prompt'],
    },
    handler: async (args) => {
      const taskId = crypto.randomUUID();
      await postQuery({
        action: 'receive_task',
        prompt: args.prompt,
        taskId,
      });
      return { taskId };
    },
  },

  // 2. baden_plan
  {
    name: 'baden_plan',
    description:
      'Call when planning an approach, making architectural decisions, or breaking down tasks. Use for any planning-phase activity.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID from baden_start_task' },
        action: {
          type: 'string',
          description: 'Plan action in snake_case (e.g. plan_refactor_approach, analyze_requirements)',
        },
        reason: { type: 'string', description: 'Specific reasoning or decision details' },
      },
      required: ['taskId', 'action', 'reason'],
    },
    handler: async (args) => {
      return postQuery({
        action: args.action,
        reason: args.reason,
        taskId: args.taskId,
      });
    },
  },

  // 3. baden_action
  {
    name: 'baden_action',
    description:
      'Call before performing any general action: reading files, modifying code, searching, creating files, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID from baden_start_task' },
        action: {
          type: 'string',
          description: 'Action description (e.g. read_auth_logic, modify_handler, search_usage)',
        },
        target: { type: 'string', description: 'Target file path or search query' },
        reason: { type: 'string', description: 'Why this action is needed' },
      },
      required: ['taskId', 'action'],
    },
    handler: async (args) => {
      return postQuery({
        action: args.action,
        target: args.target,
        reason: args.reason,
        taskId: args.taskId,
      });
    },
  },

  // 4. baden_verify
  {
    name: 'baden_verify',
    description:
      'Call after running tests, builds, lints, or any verification step. Report the result.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID from baden_start_task' },
        action: {
          type: 'string',
          description: 'Verification action (e.g. run_auth_tests, build_project, lint_check)',
        },
        result: {
          type: 'string',
          description: 'Verification result (e.g. PASS 12/12, BUILD FAILED: missing module)',
        },
        target: { type: 'string', description: 'Target file or directory' },
      },
      required: ['taskId', 'action', 'result'],
    },
    handler: async (args) => {
      return postQuery({
        action: args.action,
        result: args.result,
        target: args.target,
        taskId: args.taskId,
      });
    },
  },

  // 5. baden_rule
  {
    name: 'baden_rule',
    description:
      'Call when a rule is matched, a violation is found, or a fix is applied. Use for any rule-compliance activity.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID from baden_start_task' },
        action: {
          type: 'string',
          description: 'Rule action (e.g. violation_found, fix_applied, rule_match)',
        },
        ruleId: { type: 'string', description: 'Rule ID (e.g. C1, S-react-query)' },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Violation severity',
        },
        target: { type: 'string', description: 'Target file path' },
        reason: { type: 'string', description: 'Violation or fix details' },
      },
      required: ['taskId', 'action', 'ruleId'],
    },
    handler: async (args) => {
      return postQuery({
        action: args.action,
        ruleId: args.ruleId,
        severity: args.severity,
        target: args.target,
        reason: args.reason,
        taskId: args.taskId,
      });
    },
  },

  // 6. baden_complete_task
  {
    name: 'baden_complete_task',
    description: 'Call when the current task is fully completed. Provide a summary of what was done.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID from baden_start_task' },
        summary: { type: 'string', description: 'Summary of completed work' },
      },
      required: ['taskId', 'summary'],
    },
    handler: async (args) => {
      return postQuery({
        action: 'task_complete',
        summary: args.summary,
        taskId: args.taskId,
      });
    },
  },
];
