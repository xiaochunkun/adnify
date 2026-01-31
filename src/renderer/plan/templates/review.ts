/**
 * 代码审查工作流模板
 */

import type { WorkflowTemplate } from '../types/workflow'

export const codeReviewTemplate: WorkflowTemplate = {
  id: 'code-review',
  name: '代码审查',
  description: '自动化代码审查流程',
  category: 'quality',
  tags: ['review', 'quality', 'code'],
  
  workflow: {
    name: '代码审查',
    description: '自动化代码审查',
    version: '1.0.0',
    
    nodes: [
      {
        id: 'start',
        type: 'start',
        label: '开始',
        config: {},
      },
      {
        id: 'get-changes',
        type: 'tool',
        label: '获取变更文件',
        config: {
          toolName: 'run_command',
          arguments: {
            command: 'git diff --name-only ${variables.baseBranch}',
          },
        },
      },
      {
        id: 'review-loop',
        type: 'loop',
        label: '逐文件审查',
        config: {
          items: 'variables.changedFiles',
          itemVariable: 'file',
          bodyNodeId: 'review-file',
        },
      },
      {
        id: 'review-file',
        type: 'tool',
        label: '审查文件',
        config: {
          toolName: 'analyze_code',
          arguments: {
            path: '${loops["review-loop"].currentItem}',
          },
        },
      },
      {
        id: 'generate-report',
        type: 'llm',
        label: '生成审查报告',
        config: {
          prompt: '基于所有文件的审查结果，生成总结报告',
          outputVariable: 'report',
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
      { id: 'e1', source: 'start', target: 'get-changes' },
      { id: 'e2', source: 'get-changes', target: 'review-loop' },
      { id: 'e3', source: 'review-loop', target: 'generate-report' },
      { id: 'e4', source: 'generate-report', target: 'end' },
    ],
    
    config: {
      maxRetries: 2,
      timeout: 1800000,
      continueOnError: true,
      variables: {},
      environment: 'development',
    },
  },
  
  parameters: [
    {
      name: 'baseBranch',
      label: '基准分支',
      type: 'string',
      required: false,
      defaultValue: 'main',
    },
  ],
}
