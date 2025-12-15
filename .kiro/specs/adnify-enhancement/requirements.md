# Requirements Document

## Introduction

本文档定义了 Adnify AI 代码编辑器的增强需求，目标是在功能和用户体验上超越 Cursor。Adnify 是一个基于 Electron + React + Monaco Editor 的桌面代码编辑器，集成了 AI 辅助编程能力。本次增强将分为多个阶段，涵盖核心 AI 能力、编辑器体验、协作功能和差异化特性。

## Core Development Principles (不可变规则)

以下原则在整个项目开发过程中必须严格遵守，不可妥协：

### 1. 架构清晰
- 严格遵循分层架构：UI → State → Service → IPC → Backend
- 每个模块职责单一，边界清晰
- 依赖关系单向，禁止循环依赖
- 使用依赖注入，便于测试和替换

### 2. 代码复用性
- 提取公共逻辑到 utils/helpers
- 使用组合优于继承
- 创建可复用的 React Hooks
- 定义清晰的接口和类型

### 3. 代码可读性
- 函数/方法不超过 50 行
- 文件不超过 300 行
- 使用有意义的命名
- 添加必要的注释和 JSDoc
- 保持一致的代码风格

### 4. 性能优化
- 避免不必要的重渲染（React.memo, useMemo, useCallback）
- 大数据使用虚拟滚动
- 耗时操作使用 Web Worker
- 实现请求防抖和节流
- 懒加载非关键资源

### 5. 内存安全
- 组件卸载时清理所有订阅和定时器
- 使用 WeakMap/WeakSet 存储对象引用
- 避免闭包导致的内存泄漏
- 大对象使用后及时释放
- 实现资源池和对象复用

### 6. 错误处理
- 所有异步操作必须有 try-catch
- 使用 ErrorBoundary 捕获 React 错误
- 提供有意义的错误信息
- 实现优雅降级

### 7. 类型安全
- 禁止使用 any（除非有明确注释说明原因）
- 所有函数参数和返回值必须有类型
- 使用 strict 模式
- 定义完整的接口类型

## Glossary

- **Adnify**: 本项目的 AI 代码编辑器
- **Agent**: AI 代理，能够自主执行多步骤任务的 AI 系统
- **Composer**: 多文件编辑模式，AI 可同时修改多个文件
- **Inline Edit**: 内联编辑，在代码中直接进行 AI 辅助修改
- **Code Completion**: 代码补全，基于上下文的智能代码建议
- **RAG**: 检索增强生成，通过检索相关代码提升 AI 理解能力
- **Codebase Index**: 代码库索引，对整个项目建立语义索引
- **Checkpoint**: 检查点，AI 修改前的代码状态快照
- **MCP**: Model Context Protocol，模型上下文协议

## Requirements

### Requirement 1: 智能代码补全

**User Story:** As a developer, I want AI-powered code completion, so that I can write code faster with intelligent suggestions.

#### Acceptance Criteria

1. WHEN the user types code in the editor THEN the Adnify SHALL display inline ghost text suggestions within 200ms
2. WHEN the user presses Tab THEN the Adnify SHALL accept the current suggestion and insert it at cursor position
3. WHEN the user presses Escape THEN the Adnify SHALL dismiss the current suggestion
4. WHEN the user continues typing THEN the Adnify SHALL update suggestions based on new context
5. WHEN generating suggestions THEN the Adnify SHALL consider the current file content, open files, and recent edits as context
6. WHEN the suggestion contains multiple lines THEN the Adnify SHALL display a preview indicator showing line count

### Requirement 2: 内联编辑 (Cmd+K)

**User Story:** As a developer, I want to edit code inline using natural language, so that I can make quick modifications without leaving the editor.

#### Acceptance Criteria

1. WHEN the user presses Cmd+K (or Ctrl+K on Windows) THEN the Adnify SHALL display an inline input field at the cursor position
2. WHEN the user selects code and presses Cmd+K THEN the Adnify SHALL use the selected code as context for modification
3. WHEN the user submits an instruction THEN the Adnify SHALL generate a diff preview showing proposed changes
4. WHEN displaying the diff THEN the Adnify SHALL highlight additions in green and deletions in red
5. WHEN the user presses Enter or clicks Accept THEN the Adnify SHALL apply the changes to the document
6. WHEN the user presses Escape or clicks Reject THEN the Adnify SHALL discard the changes and restore original code
7. WHEN generating changes THEN the Adnify SHALL stream the response to show progress

### Requirement 3: 多文件编辑 (Composer Mode)

**User Story:** As a developer, I want AI to edit multiple files simultaneously, so that I can implement features that span across the codebase.

#### Acceptance Criteria

1. WHEN the user requests a multi-file change in Agent mode THEN the Adnify SHALL identify all affected files
2. WHEN proposing changes THEN the Adnify SHALL display a file tree showing all modified files
3. WHEN the user clicks on a file in the change list THEN the Adnify SHALL show the diff for that specific file
4. WHEN the user clicks "Apply All" THEN the Adnify SHALL apply all changes atomically
5. WHEN the user clicks "Apply" on individual files THEN the Adnify SHALL apply only that file's changes
6. WHEN applying changes THEN the Adnify SHALL create a checkpoint before modification
7. WHEN any file application fails THEN the Adnify SHALL rollback all changes and notify the user

### Requirement 4: 代码库索引与语义搜索

**User Story:** As a developer, I want the AI to understand my entire codebase, so that it can provide more accurate and contextual assistance.

#### Acceptance Criteria

1. WHEN a workspace is opened THEN the Adnify SHALL begin indexing all code files in the background
2. WHEN indexing THEN the Adnify SHALL display progress in the status bar
3. WHEN the user mentions @codebase in chat THEN the Adnify SHALL search the semantic index for relevant code
4. WHEN searching THEN the Adnify SHALL return the top 10 most relevant code snippets
5. WHEN the index is outdated THEN the Adnify SHALL incrementally update only changed files
6. WHEN indexing large codebases THEN the Adnify SHALL process files in batches to avoid blocking the UI

### Requirement 5: 增强的上下文管理

**User Story:** As a developer, I want to easily add context to my AI conversations, so that the AI can better understand my intent.

#### Acceptance Criteria

1. WHEN the user types @ in the chat input THEN the Adnify SHALL display a context menu with options (file, folder, symbol, web, docs)
2. WHEN the user selects @file THEN the Adnify SHALL show a file picker to select files as context
3. WHEN the user selects @folder THEN the Adnify SHALL include all files in the selected folder as context
4. WHEN the user selects @symbol THEN the Adnify SHALL search for functions, classes, and variables across the codebase
5. WHEN the user selects @web THEN the Adnify SHALL search the web and include relevant results as context
6. WHEN the user selects @docs THEN the Adnify SHALL search documentation for the current project's dependencies
7. WHEN context is added THEN the Adnify SHALL display context pills showing what's included

### Requirement 6: 智能终端集成

**User Story:** As a developer, I want the AI to understand and interact with my terminal, so that it can help me with command-line tasks.

#### Acceptance Criteria

1. WHEN the user mentions @terminal in chat THEN the Adnify SHALL include recent terminal output as context
2. WHEN the AI suggests a command THEN the Adnify SHALL display a "Run in Terminal" button
3. WHEN the user clicks "Run in Terminal" THEN the Adnify SHALL execute the command and capture output
4. WHEN a command fails THEN the Adnify SHALL automatically analyze the error and suggest fixes
5. WHEN the AI needs to run multiple commands THEN the Adnify SHALL execute them sequentially and report progress

### Requirement 7: 检查点与版本回滚

**User Story:** As a developer, I want to easily undo AI changes, so that I can safely experiment with AI suggestions.

#### Acceptance Criteria

1. WHEN the AI makes any file modification THEN the Adnify SHALL create a checkpoint with timestamp and description
2. WHEN viewing checkpoints THEN the Adnify SHALL display a timeline of all AI modifications
3. WHEN the user clicks on a checkpoint THEN the Adnify SHALL show a diff of changes made at that point
4. WHEN the user clicks "Restore" THEN the Adnify SHALL revert all files to that checkpoint state
5. WHEN restoring THEN the Adnify SHALL preserve checkpoints after the restore point for potential re-application
6. WHEN the session ends THEN the Adnify SHALL persist checkpoints for the current workspace

### Requirement 8: 本地模型支持

**User Story:** As a developer, I want to use local AI models, so that I can work offline and keep my code private.

#### Acceptance Criteria

1. WHEN configuring LLM settings THEN the Adnify SHALL provide options for Ollama and LM Studio
2. WHEN Ollama is selected THEN the Adnify SHALL auto-detect available models on localhost
3. WHEN a local model is configured THEN the Adnify SHALL use it for all AI features
4. WHEN the local model is unavailable THEN the Adnify SHALL display a clear error message with troubleshooting steps
5. WHEN switching between local and cloud models THEN the Adnify SHALL preserve conversation history

### Requirement 9: 项目规则与自定义指令

**User Story:** As a developer, I want to define project-specific rules for the AI, so that it follows my team's coding standards.

#### Acceptance Criteria

1. WHEN a .adnify/rules.md file exists in the workspace THEN the Adnify SHALL include its content in all AI prompts
2. WHEN the user creates rules THEN the Adnify SHALL provide a template with common rule categories
3. WHEN rules conflict with user instructions THEN the Adnify SHALL prioritize user instructions
4. WHEN the rules file is modified THEN the Adnify SHALL reload rules without requiring restart
5. WHEN displaying AI responses THEN the Adnify SHALL indicate when rules influenced the response

### Requirement 10: 图片与截图理解

**User Story:** As a developer, I want to share images with the AI, so that it can help me implement UI designs or debug visual issues.

#### Acceptance Criteria

1. WHEN the user pastes an image in chat THEN the Adnify SHALL upload and include it in the conversation
2. WHEN the user drags an image file into chat THEN the Adnify SHALL display a preview and include it as context
3. WHEN the user takes a screenshot (Cmd+Shift+S) THEN the Adnify SHALL capture the screen and add it to chat
4. WHEN processing images THEN the Adnify SHALL use vision-capable models to analyze content
5. WHEN the model doesn't support vision THEN the Adnify SHALL display a warning and suggest switching models

### Requirement 11: Git 集成增强

**User Story:** As a developer, I want AI-assisted Git operations, so that I can manage version control more efficiently.

#### Acceptance Criteria

1. WHEN the user opens the Git panel THEN the Adnify SHALL display changed files with diff previews
2. WHEN the user clicks "Generate Commit Message" THEN the Adnify SHALL analyze changes and suggest a conventional commit message
3. WHEN staging files THEN the Adnify SHALL allow selecting specific hunks to stage
4. WHEN the user mentions @git in chat THEN the Adnify SHALL include Git status and recent commits as context
5. WHEN merge conflicts occur THEN the Adnify SHALL offer AI-assisted conflict resolution

### Requirement 12: 性能优化

**User Story:** As a developer, I want the editor to be fast and responsive, so that I can work efficiently on large projects.

#### Acceptance Criteria

1. WHEN opening files THEN the Adnify SHALL render content within 100ms for files under 1MB
2. WHEN typing THEN the Adnify SHALL maintain input latency under 16ms
3. WHEN streaming AI responses THEN the Adnify SHALL render chunks without blocking the UI
4. WHEN indexing large codebases THEN the Adnify SHALL use Web Workers to avoid main thread blocking
5. WHEN memory usage exceeds 1GB THEN the Adnify SHALL automatically clean up unused resources

### Requirement 13: 插件系统

**User Story:** As a developer, I want to extend the editor with plugins, so that I can customize it for my specific needs.

#### Acceptance Criteria

1. WHEN the user opens the plugin panel THEN the Adnify SHALL display installed and available plugins
2. WHEN installing a plugin THEN the Adnify SHALL download and activate it without restart
3. WHEN a plugin provides commands THEN the Adnify SHALL register them in the command palette
4. WHEN a plugin provides UI THEN the Adnify SHALL render it in designated extension points
5. WHEN a plugin causes errors THEN the Adnify SHALL isolate the failure and allow disabling the plugin

### Requirement 14: 协作功能

**User Story:** As a team member, I want to share AI conversations with colleagues, so that we can collaborate on complex problems.

#### Acceptance Criteria

1. WHEN the user clicks "Share" on a conversation THEN the Adnify SHALL generate a shareable link
2. WHEN opening a shared link THEN the Adnify SHALL display the conversation in read-only mode
3. WHEN the user exports a conversation THEN the Adnify SHALL save it as Markdown with code blocks
4. WHEN importing a conversation THEN the Adnify SHALL restore the full context and continue the discussion

### Requirement 15: 智能错误诊断

**User Story:** As a developer, I want the AI to automatically detect and fix errors, so that I can resolve issues faster.

#### Acceptance Criteria

1. WHEN the editor detects syntax errors THEN the Adnify SHALL display an "AI Fix" button next to the error
2. WHEN the user clicks "AI Fix" THEN the Adnify SHALL analyze the error and propose a fix
3. WHEN build or test commands fail THEN the Adnify SHALL automatically analyze output and suggest solutions
4. WHEN the AI proposes a fix THEN the Adnify SHALL show a diff preview before applying
5. WHEN multiple fixes are possible THEN the Adnify SHALL present options ranked by confidence
