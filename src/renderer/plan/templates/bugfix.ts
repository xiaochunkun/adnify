/**
 * Bug 修复工作流模板
 */

import type { WorkflowTemplate } from '../types/workflow'

export const bugFixTemplate: WorkflowTemplate = {
  id: 'bug-fix',
  name: 'Bug 修复',
  description: '系统化的 Bug 修复流程',
  category: 'maintenance',
  tags: ['bug', 'fix', 'debugging'],
  
  workflow: {
    name: 'Bug 修复',
    description: 'Bug 修复标准流程',
    version: '1.0.0',
    
    nodes: [
      {
        id: 'start',
        type: 'start',
        label: '开始',
        config: {},
      },
      {
        id: 'reproduce',
        type: 'tool',
        label: '复现问题',
        config: {
          toolName: 'run_command',
          arguments: {
            command: '${variables.reproduceCommand}',
          },
        },
      },
      {
        id: 'analyze',
        type: 'llm',
        label: '分析原因',
        config: {
          prompt: 'Bug 描述：\n${variables.bugDescription}\n\n复现结果：\n${outputs.reproduce.output}\n\n请分析根本原因',
          outputVariable: 'analysis',
        },
      },
      {
        id: 'fix',
        type: 'tool',
        label: '修复代码',
        config: {
          toolName: 'edit_file',
          arguments: {
            path: '${variables.filePath}',
            oldStr: '${outputs.analysis.buggyCode}',
            newStr: '${outputs.analysis.fixedCode}',
          },
        },
      },
      {
        id: 'verify',
        type: 'tool',
        label: '验证修复',
        config: {
          toolName: 'run_command',
          arguments: {
            command: '${variables.verifyCommand}',
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
      { id: 'e1', source: 'start', target: 'reproduce' },
      { id: 'e2', source: 'reproduce', target: 'analyze' },
      { id: 'e3', source: 'analyze', target: 'fix' },
      { id: 'e4', source: 'fix', target: 'verify' },
      { id: 'e5', source: 'verify', target: 'end' },
    ],
    
    config: {
      maxRetries: 3,
      timeout: 1800000, // 30 minutes
      continueOnError: false,
      variables: {},
      environment: 'development',
    },
  },
  
  parameters: [
    {
      name: 'bugDescription',
      label: 'Bug 描述',
      type: 'string',
      required: true,
    },
    {
      name: 'reproduceCommand',
      label: '复现命令',
      type: 'string',
      required: true,
    },
    {
      name: 'filePath',
      label: '修复文件路径',
      type: 'string',
      required: true,
    },
    {
      name: 'verifyCommand',
      label: '验证命令',
      type: 'string',
      required: true,
    },
  ],
}
