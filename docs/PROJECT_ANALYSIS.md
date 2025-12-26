# 项目架构分析报告

## 概述

这是一个 Electron + React + TypeScript 的 AI 编程助手项目（类似 Cursor/Windsurf）。项目整体架构清晰，但存在一些需要优化的问题。

---

## 🔴 严重问题

### 1. 类型定义重复（5+ 处） ✅ 已修复

**问题**: 同一个类型在多个文件中重复定义，导致维护困难和潜在的类型不一致。

**解决方案**:
- 创建 `src/shared/types/llm.ts` 作为 LLM 相关类型的单一来源
- 区分 `LLMToolCall` (LLM 返回的原始工具调用) 和 `ToolCall` (UI 层带状态的工具调用)
- 区分 `LLMError` (接口) 和 `LLMErrorClass` (可实例化的错误类)
- `src/main/services/llm/types.ts` 只定义主进程专用类型，其他从 shared 重新导出
- 删除 `src/renderer/agent/tools/types.ts`，所有工具类型直接从 `@/shared/types` 导入

### 2. Provider 配置架构混乱

**问题**: Provider 相关的类型和配置分散在多个文件中：

```
src/shared/config/providers.ts      - UnifiedProviderConfig, LLMAdapterConfig
src/shared/types/customProvider.ts  - CustomProviderConfig, CustomModeConfig
src/renderer/types/provider.ts      - ProviderModelConfig, CustomProviderConfig (重复!)
src/renderer/services/settingsService.ts - ProviderConfig, LLMConfig
src/main/services/llm/types.ts      - LLMConfig, ProviderType
```

**建议**:
- 统一到 `src/shared/config/providers.ts`
- 删除 `src/renderer/types/provider.ts` 中的重复定义
- 明确区分：配置类型 vs 运行时类型

---

## 🟡 中等问题

### 3. Agent 模块 `core/` 目录残留

**问题**: 重构后 `src/renderer/agent/core/` 目录仍存在，只有 `index.ts` 作为兼容层。

**建议**:
- 更新所有导入直接使用新路径
- 删除 `core/index.ts` 兼容层
- 或保留但添加 `@deprecated` 注释

### 4. 设置服务重复逻辑

**问题**: `settingsService.ts` 和 `settingsSlice.ts` 存在功能重叠：

- `settingsService.ts`: 负责加载/保存设置
- `settingsSlice.ts`: Zustand store，也有加载逻辑

**建议**:
- `settingsSlice` 只负责状态管理
- 所有 I/O 操作委托给 `settingsService`
- 移除 `settingsSlice.loadSettings()` 中的重复逻辑

### 5. 常量定义分散

**问题**: 常量分散在多个文件中：

```
src/shared/constants.ts           - FILE_LIMITS, LAYOUT_LIMITS, SECURITY_DEFAULTS
src/shared/config/agentConfig.ts  - DEFAULT_AGENT_CONFIG, DEFAULT_TOOL_METADATA
src/renderer/config/editorConfig.ts - 编辑器配置
```

**建议**:
- 按功能域组织常量
- 考虑合并到 `src/shared/config/` 下的对应文件

### 6. 两套 Store 系统

**问题**: 项目同时使用两套状态管理：

```
src/renderer/store/index.ts       - 主 Store (useStore)
src/renderer/agent/store/AgentStore.ts - Agent Store (useAgentStore)
```

**建议**:
- 评估是否需要合并
- 如果保持分离，明确职责边界
- 考虑使用 Zustand 的 `combine` 或 `subscribeWithSelector`

---

## 🟢 轻微问题

### 7. 未使用的代码和文件

**已删除:**
- ✅ `src/renderer/agent/core/` - 兼容层目录，已无引用
- ✅ `src/renderer/types/provider.ts` 中的 `CustomProviderConfig` - 与 `shared/types/customProvider.ts` 重复

**未使用但保留（可能为未来功能准备）:**

1. **`src/shared/config/promptConfig.ts`** - 整个文件未被使用
   - `PromptConfig`, `PromptTemplate`, `PromptComponent` 类型
   - `CORE_TOOLS_COMPONENT`, `WORKFLOW_COMPONENT`, `ENVIRONMENT_COMPONENT`, `PLANNING_TOOLS_COMPONENT` 组件
   - `DEFAULT_PROMPT_CONFIG` 默认配置
   - `replaceTemplatePlaceholders`, `mergePromptComponents`, `createCustomTemplate`, `validateTemplate` 函数
   - 实际使用的是 `src/renderer/agent/prompts/promptTemplates.ts`

2. **`src/renderer/agent/services/contextService.ts`** - 导出但未调用
   - `parseFileReferences`, `cleanFileReferences`, `expandFileReference`, `expandFolderReference` 等方法
   - 可能是为 @file, @folder 等上下文引用功能准备的

### 8. 未使用的导出

**文件**: `src/renderer/agent/prompts/promptTemplates.ts`

- `PLANNING_TOOLS_DESC` 导出但只在 `prompts.ts` 中动态导入
- 建议：改为内部函数或直接在 `prompts.ts` 中定义

### 8. 类型导入不一致

**问题**: 有些地方使用 `import type`，有些使用普通 `import`

**建议**: 统一使用 `import type` 导入纯类型

### 9. 日志系统分散

**问题**: 日志工具在两个位置：

```
src/shared/utils/Logger.ts
src/main/utils/Logger.ts
```

**建议**: 统一到 `src/shared/utils/Logger.ts`

---

## 📋 功能完整性检查

### 已实现功能 ✅

1. **LLM 集成**: OpenAI, Anthropic, Gemini, 自定义 Provider
2. **工具系统**: 文件操作、终端、LSP、搜索
3. **代码索引**: 向量搜索、语义搜索
4. **编辑器**: Monaco Editor 集成
5. **多窗口支持**: 每个窗口独立的 LLM 服务
6. **Checkpoint 系统**: 文件快照和回滚
7. **Plan 模式**: 任务规划和执行

### 可能未完成的功能 ⚠️

1. **自定义 Provider 编辑**: `InlineProviderEditor` 的 `provider` prop 刚修复
2. **Embedding 配置**: `EmbeddingConfig` 定义了但 UI 可能不完整
3. **OAuth 认证**: `AuthType` 包含 'oauth' 但未见实现
4. **代码补全**: `completionService.ts` 存在但集成状态不明

---

## 🔧 建议的重构优先级

### P0 - 立即修复 ✅ 已完成
1. ✅ 统一 `ToolCall`, `LLMConfig`, `ToolDefinition` 类型定义
   - 创建 `src/shared/types/llm.ts` 作为单一来源
   - `LLMToolCall` (无状态) vs `ToolCall` (有 UI 状态) 明确区分
   - `LLMErrorClass` (可实例化) vs `LLMError` (接口) 明确区分
   - 删除 `src/renderer/agent/tools/types.ts`，直接从 shared 导入
   - 更新所有 provider 使用新类型

2. ✅ 清理 Provider 配置架构
   - 已在之前的任务中完成

### P1 - 短期优化
3. 删除 `agent/core/` 兼容层
4. 统一设置服务逻辑
5. 整理常量文件

### P2 - 长期改进
6. 评估 Store 合并
7. 统一日志系统
8. 完善类型导入规范

---

## 📁 建议的目录结构

```
src/
├── shared/                    # 主进程和渲染进程共享
│   ├── config/               # 配置中心
│   │   ├── providers.ts      # Provider 配置（统一）
│   │   ├── agentConfig.ts    # Agent 配置
│   │   └── promptConfig.ts   # 提示词配置
│   ├── types/                # 共享类型（单一来源）
│   │   ├── llm.ts           # LLM 相关类型
│   │   ├── tools.ts         # 工具相关类型
│   │   └── index.ts         # 统一导出
│   └── utils/               # 共享工具
│
├── main/                     # 主进程
│   ├── services/llm/        # LLM 服务
│   └── ipc/                 # IPC 处理
│
└── renderer/                 # 渲染进程
    ├── agent/               # Agent 模块（已重构）
    │   ├── store/          # 状态管理
    │   ├── services/       # 服务层
    │   ├── tools/          # 工具系统
    │   ├── llm/            # LLM 通信
    │   ├── prompts/        # 提示词
    │   └── utils/          # 工具函数
    ├── store/              # 全局 Store
    └── components/         # UI 组件
```

---

## 总结

项目整体架构良好，主要问题是类型定义重复和配置分散。建议按优先级逐步重构，避免一次性大改动带来的风险。
