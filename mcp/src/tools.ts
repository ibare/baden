import { postQuery } from './client.js';

/** taskId → projectName 매핑 (세션 내 메모리) */
const taskProjectMap = new Map<string, string>();

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
        projectName: { type: 'string', description: 'Project name as defined in CLAUDE.md (e.g. "baden")' },
      },
      required: ['prompt', 'projectName'],
    },
    handler: async (args) => {
      const taskId = crypto.randomUUID();
      const projectName = args.projectName as string;
      taskProjectMap.set(taskId, projectName);
      await postQuery({
        action: 'receive_task',
        prompt: args.prompt,
        projectName,
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
          description:
            'Action in snake_case. The first word determines event classification. ' +
            'Use planning verbs: plan, analyze, review, decide, compile, synthesize, finalize. ' +
            '(e.g. plan_refactor_approach, analyze_requirements, review_architecture)',
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
        projectName: taskProjectMap.get(args.taskId as string),
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
          description:
            'Action in snake_case. The first word determines event classification. ' +
            'For reading/searching: read, search, scan, find, list, identify. ' +
            'For code changes: modify, create, add, update, write, fix, edit, delete. ' +
            '(e.g. read_auth_logic, modify_handler, search_usage, create_migration)',
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
        projectName: taskProjectMap.get(args.taskId as string),
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
          description:
            'Action in snake_case. The first word determines event classification. ' +
            'Use verification verbs: test, build, lint, typecheck, validate, verify. ' +
            '"run" prefix is ignored — place the verb after it (e.g. run_test, run_build). ' +
            '(e.g. test_auth_flow, build_project, lint_check, run_typecheck)',
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
        projectName: taskProjectMap.get(args.taskId as string),
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
          description:
            'Action in snake_case. The first word determines event classification. ' +
            'Use rule-compliance verbs: violation, check, rule. ' +
            '(e.g. violation_found, check_c5_compliance, rule_match)',
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
        projectName: taskProjectMap.get(args.taskId as string),
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
      const taskId = args.taskId as string;
      const projectName = taskProjectMap.get(taskId);
      const result = await postQuery({
        action: 'task_complete',
        summary: args.summary,
        taskId,
        projectName,
      });
      taskProjectMap.delete(taskId);
      return result;
    },
  },
];
