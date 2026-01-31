/**
 * 代码重构工作流模板
 */

import type { WorkflowTemplate } from '../types/workflow'

export const refactoringTemplate: WorkflowTemplate = {
  id: 'refactoring',
  name: '代码重构',
  description: '安全的代码重构流程',
  category: 'maintenance',
  tags: ['refactor', 'quality', 'improvement'],
  
  workflow: {
    name: '代码重构',
    description: '安全的重构流程',
    version: '1.0.0',
    
    nodes: [
      {
        id: 'start',
        type: 'start',
        label: '开始',
        config: {},
      },
      {
        id: 'test-before',
        type: 'tool',
        label: '运行测试（重构前）',
        config: {
          toolName: 'run_command',
          arguments: {
            command: 'npm test',
          },
        },
      },
      {
        id: 'analyze',
        type: 'tool',
        label: '分析代码',
        config: {
          toolName: 'analyze_code',
          arguments: {
            path: '${variables.targetFile}',
          },
        },
      },
      {
        id: 'refactor',
        type: 'tool',
        label: '执行重构',
        config: {
          toolName: 'write_file',
          arguments: {
            path: '${variables.targetFile}',
            content: '${outputs.analyze.refactoredCode}',
          },
        },
      },
      {
        id: 'test-after',
        type: 'tool',
        label: '运行测试（重构后）',
        config: {
          toolName: 'run_command',
          arguments: {
            command: 'npm test',
          },
        },
      },
      {
        id: 'check',
        type: 'decision',
        label: '测试通过？',
        config: {
          condition: 'outputs["test-after"].exitCode === 0',
          trueNext: 'end',
          falseNext: 'rollback',
        },
      },
      {
        id: 'rollback',
        type: 'tool',
        label: '回滚变更',
        config: {
          toolName: 'run_command',
          arguments: {
            command: 'git checkout ${variables.targetFile}',
          },
        },
      },
      {
        id: 'end',
        type: 'end',
        label: '完成',
        config: {},
      },
    ],
    
    edges: [
      { id: 'e1', source: 'start', target: 'test-before' },
      { id: 'e2', source: 'test-before', target: 'analyze' },
      { id: 'e3', source: 'analyze', target: 'refactor' },
      { id: 'e4', source: 'refactor', target: 'test-after' },
      { id: 'e5', source: 'test-after', target: 'check' },
      { id: 'e6', source: 'check', target: 'end', condition: 'true' },
      { id: 'e7', source: 'check', target: 'rollback', condition: 'false' },
      { id: 'e8', source: 'rollback', target: 'end' },
    ],
    
    config: {
      maxRetries: 2,
      timeout: 1800000,
      continueOnError: false,
      variables: {},
      environment: 'development',
    },
  },
  
  parameters: [
    {
      name: 'targetFile',
      label: '目标文件',
      type: 'string',
      required: true,
    },
  ],
}
