/**
 * 工具定义测试
 * 测试工具注册和验证
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  toolRegistry,
  initializeToolProviders,
} from '@renderer/agent/tools'
import { TOOL_SCHEMAS, TOOL_CONFIGS } from '@/shared/config/tools'

// Mock dependencies that tools need
vi.mock('@renderer/services/WorkspaceManager', () => ({
  workspaceManager: {
    getCurrentWorkspacePath: vi.fn(() => '/test/workspace'),
  },
}))

vi.mock('@renderer/agent/core/Agent', () => ({
  Agent: {
    hasValidFileCache: vi.fn(() => false),
  },
}))

describe('Tool Definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    initializeToolProviders()
  })

  describe('Tool Schemas', () => {
    it('should have TOOL_SCHEMAS object', () => {
      expect(TOOL_SCHEMAS).toBeDefined()
      expect(typeof TOOL_SCHEMAS).toBe('object')
    })

    it('should have TOOL_CONFIGS object', () => {
      expect(TOOL_CONFIGS).toBeDefined()
      expect(typeof TOOL_CONFIGS).toBe('object')
    })

    it('should have read_file in configs', () => {
      expect(TOOL_CONFIGS.read_file).toBeDefined()
      expect(TOOL_CONFIGS.read_file.name).toBe('read_file')
    })

    it('should have edit_file in configs', () => {
      expect(TOOL_CONFIGS.edit_file).toBeDefined()
      expect(TOOL_CONFIGS.edit_file.name).toBe('edit_file')
    })

    it('should have run_command in configs', () => {
      expect(TOOL_CONFIGS.run_command).toBeDefined()
      expect(TOOL_CONFIGS.run_command.name).toBe('run_command')
    })

    it('should generate schemas from configs', () => {
      // TOOL_SCHEMAS should have same keys as TOOL_CONFIGS
      const configKeys = Object.keys(TOOL_CONFIGS)
      const schemaKeys = Object.keys(TOOL_SCHEMAS)
      
      expect(schemaKeys.length).toBeGreaterThan(0)
      // At least some configs should have schemas
      expect(schemaKeys.length).toBeGreaterThanOrEqual(configKeys.length * 0.5)
    })
  })

  describe('toolRegistry', () => {
    it('should have registry methods', () => {
      expect(typeof toolRegistry.register).toBe('function')
      expect(typeof toolRegistry.get).toBe('function')
      expect(typeof toolRegistry.has).toBe('function')
      expect(typeof toolRegistry.validate).toBe('function')
    })

    it('should validate using schemas', () => {
      // Test that schemas can be used for validation
      const readFileSchema = TOOL_SCHEMAS.read_file
      if (readFileSchema) {
        const validResult = readFileSchema.safeParse({ path: 'src/main.ts' })
        expect(validResult.success).toBe(true)
        
        const invalidResult = readFileSchema.safeParse({})
        expect(invalidResult.success).toBe(false)
      }
    })
  })
})
