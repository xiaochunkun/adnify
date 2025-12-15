# Implementation Plan

## ⚠️ 核心开发原则 (每个任务必须遵守)

**以下原则在所有任务实现中必须严格遵守，不可妥协：**

1. **架构清晰** - 严格分层，职责单一，禁止循环依赖
2. **代码复用** - 提取公共逻辑，使用组合优于继承
3. **代码可读** - 函数≤50行，文件≤300行，命名有意义
4. **性能优化** - React.memo, useMemo, useCallback, 防抖节流
5. **内存安全** - useEffect 必须清理订阅/定时器，避免闭包泄漏
6. **错误处理** - 所有异步操作 try-catch，ErrorBoundary
7. **类型安全** - 禁止 any，完整类型定义

**代码审查清单（每个任务完成前检查）：**
- [ ] 无 any 类型
- [ ] useEffect 有清理函数
- [ ] 使用 React.memo 优化
- [ ] 异步有错误处理
- [ ] 函数/文件长度合规

---

## Phase 1: 核心 AI 能力

- [ ] 1. 代码补全服务
  - [ ] 1.1 创建 CompletionService 基础架构
    - 创建 `src/renderer/services/completionService.ts`
    - 定义 CompletionContext、CompletionResult、CompletionSuggestion 接口
    - 实现 debounce 机制和请求取消
    - _Requirements: 1.1, 1.4_
  - [ ]* 1.2 编写 CompletionService 属性测试
    - **Property 3: Context includes required fields**
    - **Validates: Requirements 1.5**
  - [ ] 1.3 实现上下文收集逻辑
    - 收集当前文件内容、光标位置
    - 分析 import/require 获取相关文件
    - 获取最近编辑的文件列表
    - _Requirements: 1.5_
  - [ ] 1.4 实现 Ghost Text Widget
    - 创建 Monaco IContentWidget 实现
    - 实现 show/hide/accept 方法
    - 添加样式（半透明、斜体）
    - _Requirements: 1.1, 1.6_
  - [ ]* 1.5 编写 Ghost Text 属性测试
    - **Property 1: Tab acceptance inserts suggestion**
    - **Property 2: Escape dismisses suggestion**
    - **Validates: Requirements 1.2, 1.3**
  - [ ] 1.6 集成到 Editor 组件
    - 添加键盘事件监听（Tab、Escape）
    - 实现自动触发逻辑
    - 添加 Ctrl+Space 手动触发
    - _Requirements: 1.2, 1.3_
  - [ ] 1.7 添加补全设置选项
    - 在 SettingsModal 添加补全开关
    - 添加 debounce 时间配置
    - 添加 maxTokens 配置
    - _Requirements: 1.1_

- [ ] 2. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 3. 内联编辑 (Cmd+K)
  - [ ] 3.1 创建 InlineEditService
    - 创建 `src/renderer/services/inlineEditService.ts`
    - 定义状态机（idle → input → generating → preview → applying）
    - 实现 start/submit/accept/reject/cancel 方法
    - _Requirements: 2.1, 2.5, 2.6_
  - [ ]* 3.2 编写 InlineEditService 属性测试
    - **Property 4: Cmd+K activates inline edit**
    - **Property 5: Selection included in context**
    - **Property 6: Accept applies changes**
    - **Property 7: Reject restores original**
    - **Validates: Requirements 2.1, 2.2, 2.5, 2.6**
  - [ ] 3.3 创建 InlineEditWidget 组件
    - 创建 `src/renderer/components/InlineEditWidget.tsx`
    - 实现输入框 UI
    - 实现 Diff 预览 UI（绿色添加、红色删除）
    - 添加 Accept/Reject 按钮
    - _Requirements: 2.1, 2.3, 2.4_
  - [ ] 3.4 实现 Diff 生成算法
    - 使用 diff 库实现行级别差异
    - 生成 DiffHunk 数组
    - _Requirements: 2.3, 2.4_
  - [ ] 3.5 集成到 Editor 组件
    - 添加 Cmd+K / Ctrl+K 快捷键
    - 处理选中文本作为上下文
    - 实现流式响应显示
    - _Requirements: 2.1, 2.2, 2.7_
  - [ ]* 3.6 编写内联编辑单元测试
    - 测试状态转换
    - 测试 Diff 生成
    - _Requirements: 2.1-2.7_

- [ ] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 5. 增强上下文管理
  - [ ] 5.1 扩展 ContextService
    - 更新 `src/renderer/agent/contextService.ts`
    - 添加 @folder、@symbol、@terminal、@git 解析
    - 实现 searchSymbols 方法
    - _Requirements: 5.1, 5.3, 5.4_
  - [ ]* 5.2 编写 ContextService 属性测试
    - **Property 12: @folder expansion**
    - **Validates: Requirements 5.3**
  - [ ] 5.3 创建符号索引
    - 使用 Monaco 语言服务获取符号
    - 建立符号 → 文件位置映射
    - _Requirements: 5.4_
  - [ ] 5.4 更新 FileMentionPopup
    - 添加 @folder、@symbol 选项
    - 实现符号搜索 UI
    - 显示符号类型图标
    - _Requirements: 5.1, 5.4_
  - [ ] 5.5 实现上下文 Pills 显示
    - 在聊天输入框上方显示已添加的上下文
    - 支持点击移除
    - 显示上下文类型图标
    - _Requirements: 5.7_
  - [ ]* 5.6 编写上下文 Pills 属性测试
    - **Property 13: Context pills display**
    - **Validates: Requirements 5.7**

- [ ] 6. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

## Phase 2: 高级功能

- [ ] 7. Composer 多文件编辑
  - [ ] 7.1 创建 ComposerService
    - 创建 `src/renderer/services/composerService.ts`
    - 实现 analyzeTask 方法（识别受影响文件）
    - 实现 generatePlan 方法（生成更改计划）
    - _Requirements: 3.1, 3.2_
  - [ ] 7.2 实现原子性更改应用
    - 实现 applyChanges 方法
    - 集成 CheckpointService 创建检查点
    - 实现失败回滚逻辑
    - _Requirements: 3.4, 3.6, 3.7_
  - [ ]* 7.3 编写 ComposerService 属性测试
    - **Property 8: Atomic apply all**
    - **Property 9: Checkpoint before modification**
    - **Validates: Requirements 3.4, 3.6, 3.7**
  - [ ] 7.4 创建 ComposerPanel 组件
    - 创建 `src/renderer/components/ComposerPanel.tsx`
    - 显示受影响文件树
    - 显示每个文件的 Diff 预览
    - 添加 Apply All / Apply Individual 按钮
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [ ] 7.5 集成到 ChatPanel
    - 在 Agent 模式下检测多文件更改
    - 自动切换到 Composer 视图
    - _Requirements: 3.1_
  - [ ]* 7.6 编写 Composer 集成测试
    - 测试多文件更改流程
    - 测试回滚功能
    - _Requirements: 3.1-3.7_

- [ ] 8. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 9. 代码库索引
  - [ ] 9.1 创建 IndexService
    - 创建 `src/renderer/services/indexService.ts`
    - 定义 CodeIndex、FileIndex、CodeChunk 数据结构
    - 实现 startIndexing 方法
    - _Requirements: 4.1_
  - [ ] 9.2 实现文件分块与 TF-IDF
    - 按函数/类/块分割代码
    - 计算每个块的 TF-IDF 向量
    - _Requirements: 4.3_
  - [ ] 9.3 实现语义搜索
    - 实现 search 方法
    - 使用余弦相似度排序
    - 限制返回结果数量
    - _Requirements: 4.3, 4.4_
  - [ ]* 9.4 编写 IndexService 属性测试
    - **Property 10: Search result limit**
    - **Property 11: Incremental update**
    - **Validates: Requirements 4.4, 4.5**
  - [ ] 9.5 实现增量更新
    - 监听文件变化
    - 只重新索引变化的文件
    - _Requirements: 4.5_
  - [ ] 9.6 实现索引持久化
    - 保存索引到 .adnify/index.json
    - 启动时加载已有索引
    - _Requirements: 4.1_
  - [ ] 9.7 添加状态栏进度显示
    - 在 StatusBar 显示索引进度
    - 显示已索引/总文件数
    - _Requirements: 4.2_
  - [ ] 9.8 集成 @codebase 上下文
    - 在 ContextService 添加 @codebase 处理
    - 调用 IndexService.search
    - _Requirements: 4.3_

- [ ] 10. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 11. 检查点增强
  - [ ] 11.1 扩展 CheckpointService
    - 更新 `src/renderer/agent/checkpointService.ts`
    - 添加 getDetails 方法（返回文件快照和 Diff）
    - 添加 persist/load 方法
    - _Requirements: 7.1, 7.3, 7.6_
  - [ ]* 11.2 编写 CheckpointService 属性测试
    - **Property 14: Checkpoint creation on modification**
    - **Property 15: Restore matches checkpoint**
    - **Property 16: Restore preserves future checkpoints**
    - **Validates: Requirements 7.1, 7.4, 7.5**
  - [ ] 11.3 创建 CheckpointTimeline 组件
    - 创建 `src/renderer/components/CheckpointTimeline.tsx`
    - 显示时间线视图
    - 点击显示 Diff 详情
    - 添加 Restore 按钮
    - _Requirements: 7.2, 7.3, 7.4_
  - [ ] 11.4 实现检查点持久化
    - 保存到 .adnify/checkpoints/
    - 按工作区分组
    - 启动时加载
    - _Requirements: 7.6_

- [ ] 12. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

## Phase 3: 本地化与扩展

- [ ] 13. 本地模型支持
  - [ ] 13.1 创建 OllamaProvider
    - 创建 `src/main/llm/providers/ollama.ts`
    - 实现 detectModels 方法
    - 实现 sendMessage 流式响应
    - 实现 healthCheck 方法
    - _Requirements: 8.1, 8.2_
  - [ ]* 13.2 编写 OllamaProvider 属性测试
    - **Property 17: Model detection**
    - **Validates: Requirements 8.2**
  - [ ] 13.3 创建 LMStudioProvider
    - 创建 `src/main/llm/providers/lmstudio.ts`
    - 复用 OpenAI 兼容 API
    - 实现 detectModels 方法
    - _Requirements: 8.1_
  - [ ] 13.4 更新 LLMService
    - 添加本地模型提供商支持
    - 实现自动检测逻辑
    - 处理连接失败错误
    - _Requirements: 8.3, 8.4_
  - [ ]* 13.5 编写模型切换属性测试
    - **Property 18: Conversation preservation on model switch**
    - **Validates: Requirements 8.5**
  - [ ] 13.6 更新 SettingsModal
    - 添加 Ollama/LM Studio 选项
    - 显示检测到的模型列表
    - 添加连接测试按钮
    - _Requirements: 8.1, 8.4_

- [ ] 14. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 15. 项目规则系统
  - [ ] 15.1 创建 RulesService
    - 创建 `src/renderer/services/rulesService.ts`
    - 实现 loadRules 方法
    - 实现文件监听热加载
    - 实现 getRulesPrompt 方法
    - _Requirements: 9.1, 9.4_
  - [ ]* 15.2 编写 RulesService 属性测试
    - **Property 19: Rules inclusion in prompts**
    - **Property 20: Rules hot reload**
    - **Validates: Requirements 9.1, 9.4**
  - [ ] 15.3 集成到 Agent
    - 在 prompts.ts 添加规则注入
    - 用户指令优先于规则
    - _Requirements: 9.1, 9.3_
  - [ ] 15.4 创建规则模板
    - 创建默认规则模板
    - 添加创建规则文件命令
    - _Requirements: 9.2_
  - [ ] 15.5 添加规则指示器
    - 在 AI 响应中显示规则影响标记
    - _Requirements: 9.5_

- [ ] 16. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 17. 图片理解
  - [ ] 17.1 创建 ImageService
    - 创建 `src/renderer/services/imageService.ts`
    - 实现图片格式验证
    - 实现图片缩放
    - 实现 base64 转换
    - _Requirements: 10.1, 10.2_
  - [ ] 17.2 实现粘贴图片
    - 在 ChatPanel 添加 paste 事件监听
    - 处理图片数据
    - 显示图片预览
    - _Requirements: 10.1_
  - [ ] 17.3 实现拖拽图片
    - 添加 drag & drop 支持
    - 显示拖拽区域指示
    - _Requirements: 10.2_
  - [ ] 17.4 实现截图功能
    - 在 main process 添加截图 IPC
    - 添加 Cmd+Shift+S 快捷键
    - _Requirements: 10.3_
  - [ ] 17.5 实现视觉模型检测
    - 检查当前模型是否支持视觉
    - 不支持时显示警告
    - _Requirements: 10.4, 10.5_
  - [ ]* 17.6 编写图片处理属性测试
    - **Property 21: Vision model requirement**
    - **Validates: Requirements 10.4, 10.5**

- [ ] 18. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

## Phase 4: 集成与优化

- [ ] 19. Git 集成增强
  - [ ] 19.1 创建 GitService
    - 创建 `src/renderer/services/gitService.ts`
    - 实现 getStatus 方法
    - 实现 getRecentCommits 方法
    - 实现 getDiff 方法
    - _Requirements: 11.1, 11.4_
  - [ ] 19.2 创建 GitPanel 组件
    - 创建 `src/renderer/components/GitPanel.tsx`
    - 显示变更文件列表
    - 显示 Diff 预览
    - _Requirements: 11.1_
  - [ ] 19.3 实现 AI 提交消息生成
    - 分析 Diff 内容
    - 生成 Conventional Commit 格式消息
    - _Requirements: 11.2_
  - [ ] 19.4 实现 Hunk 级别暂存
    - 显示每个 Hunk 的暂存复选框
    - 实现部分暂存
    - _Requirements: 11.3_
  - [ ] 19.5 集成 @git 上下文
    - 在 ContextService 添加 @git 处理
    - 包含状态和最近提交
    - _Requirements: 11.4_
  - [ ]* 19.6 编写 Git 上下文属性测试
    - **Property 22: @git context inclusion**
    - **Validates: Requirements 11.4**
  - [ ] 19.7 实现冲突解决辅助
    - 检测合并冲突
    - 提供 AI 解决选项
    - _Requirements: 11.5_

- [ ] 20. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 21. 智能错误诊断
  - [ ] 21.1 创建 DiagnosticsService
    - 创建 `src/renderer/services/diagnosticsService.ts`
    - 监听 Monaco 诊断事件
    - 收集错误信息
    - _Requirements: 15.1_
  - [ ] 21.2 实现 AI Fix 按钮
    - 在错误行旁显示修复按钮
    - 点击触发 AI 分析
    - _Requirements: 15.1, 15.2_
  - [ ] 21.3 实现错误分析
    - 发送错误上下文到 LLM
    - 生成修复建议
    - _Requirements: 15.2_
  - [ ] 21.4 实现命令失败分析
    - 监听终端命令退出码
    - 自动分析失败输出
    - _Requirements: 15.3_
  - [ ] 21.5 实现多修复选项
    - 生成多个可能的修复
    - 按置信度排序
    - _Requirements: 15.5_
  - [ ]* 21.6 编写错误诊断属性测试
    - **Property 23: Fix proposal includes diff**
    - **Property 24: Multiple fixes ranked**
    - **Validates: Requirements 15.4, 15.5**

- [ ] 22. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 23. 性能优化
  - [ ] 23.1 优化文件打开性能
    - 实现虚拟滚动
    - 延迟加载大文件
    - _Requirements: 12.1_
  - [ ] 23.2 优化输入延迟
    - 使用 requestAnimationFrame
    - 减少不必要的重渲染
    - _Requirements: 12.2_
  - [ ] 23.3 优化流式渲染
    - 批量更新 DOM
    - 使用 React.memo 优化
    - _Requirements: 12.3_
  - [ ] 23.4 实现 Web Worker 索引
    - 将索引逻辑移到 Worker
    - 避免阻塞主线程
    - _Requirements: 12.4_
  - [ ] 23.5 实现内存管理
    - 监控内存使用
    - 自动清理未使用资源
    - _Requirements: 12.5_

- [ ] 24. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

## Phase 5: 生态系统

- [ ] 25. 插件系统
  - [ ] 25.1 设计插件 API
    - 定义插件接口
    - 定义扩展点
    - 创建插件沙箱
    - _Requirements: 13.1, 13.4_
  - [ ] 25.2 实现插件加载器
    - 动态加载插件
    - 热重载支持
    - _Requirements: 13.2_
  - [ ] 25.3 实现命令注册
    - 插件注册命令到命令面板
    - _Requirements: 13.3_
  - [ ] 25.4 实现错误隔离
    - 插件错误不影响主应用
    - 提供禁用选项
    - _Requirements: 13.5_
  - [ ] 25.5 创建 PluginPanel
    - 显示已安装插件
    - 提供启用/禁用开关
    - _Requirements: 13.1_

- [ ] 26. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户

- [ ] 27. 协作功能
  - [ ] 27.1 实现会话导出
    - 导出为 Markdown
    - 包含代码块
    - _Requirements: 14.3_
  - [ ] 27.2 实现会话导入
    - 解析 Markdown
    - 恢复对话上下文
    - _Requirements: 14.4_
  - [ ] 27.3 实现分享链接（可选）
    - 生成分享链接
    - 只读模式查看
    - _Requirements: 14.1, 14.2_

- [ ] 28. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
