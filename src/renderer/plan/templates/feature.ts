/**
 * 功能开发工作流模板
 */

import type { WorkflowTemplate } from '../types/workflow'

export const featureDevelopmentTemplate: WorkflowTemplate = {
  id: 'feature-development',
  name: '功能开发',
  description: '完整的功能开发流程，从需求分析到测试验证',
  category: 'development',
  tags: ['feature', 'development', 'full-cycle'],
  
  workflow: {
    name: '功能开发',
    description: '新功能开发完整流程',
    version: '1.0.0',
    
    nodes: [
      {
        id: 'start',
        type: 'start',
        label: '开始',
        config: {},
      },
      {
        id: 'analyze',
        type: 'tool',
        label: '分析需求',
        description: '读取项目文件，了解现有架构',
        config: {
          toolName: 'read_file',
          arguments: {
            path: '${variables.projectPath}/package.json',
          },
        },
      },
      {
        id: 'design',
        type: 'llm',
        label: '生成技术方案',
        description: '基于需求生成技术设计',
        config: {
          prompt: '基于以下需求生成技术方案：\n\n${variables.requirements}\n\n请包含：架构设计、技术选型、接口设计',
          outputVariable: 'design',
        },
      },
      {
        id: 'implement',
        type: 'tool',
        label: '实现功能',
        description: '编写代码实现功能',
        config: {
          toolName: 'write_file',
          arguments: {
            path: '${variables.featurePath}',
            content: '${outputs.design.code}',
          },
        },
      },
      {
        id: 'test',
        type: 'tool',
        label: '运行测试',
        description: '执行测试套件',
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
          condition: 'outputs.test.exitCode === 0',
          trueNext: 'end',
          falseNext: 'fix',
        },
      },
      {
        id: 'fix',
        type: 'llm',
        label: '修复问题',
        description: '分析测试失败原因并修复',
        config: {
          prompt: '测试失败，请分析原因并提供修复方案：\n\n${outputs.test.output}',
          outputVariable: 'fixes',
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
      { id: 'e1', source: 'start', target: 'analyze' },
      { id: 'e2', source: 'analyze', target: 'design' },
      { id: 'e3', source: 'design', target: 'implement' },
      { id: 'e4', source: 'implement', target: 'test' },
      { id: 'e5', source: 'test', target: 'check' },
      { id: 'e6', source: 'check', target: 'end', condition: 'true' },
      { id: 'e7', source: 'check', target: 'fix', condition: 'false' },
      { id: 'e8', source: 'fix', target: 'test' },
    ],
    
    config: {
      maxRetries: 3,
      timeout: 3600000, // 1 hour
      continueOnError: false,
      variables: {},
      environment: 'development',
    },
  },
  
  parameters: [
    {
      name: 'projectPath',
      label: '项目路径',
      type: 'string',
      required: true,
    },
    {
      name: 'featurePath',
      label: '功能文件路径',
      type: 'string',
      required: true,
    },
    {
      name: 'requirements',
      label: '功能需求',
      type: 'string',
      required: true,
    },
  ],
}
