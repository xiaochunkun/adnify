/**
 * 情绪上下文分析器
 * 分析代码上下文、AI交互模式等，提供更智能的情绪检测
 */

import type { CodeContext, BehaviorMetrics, EmotionState } from '../types/emotion'
import { EventBus } from '../core/EventBus'

class EmotionContextAnalyzer {
  private recentFiles: string[] = []
  private searchHistory: number[] = []
  private aiInteractionHistory: Array<{
    timestamp: number
    type: 'question' | 'suggestion_accepted' | 'suggestion_rejected' | 'command'
    complexity: 'simple' | 'medium' | 'complex'
  }> = []
  private gitActivityHistory: Array<{ timestamp: number; type: 'commit' | 'push' | 'pull' }> = []
  private errorHistory: Array<{ timestamp: number; type: 'syntax' | 'type' | 'runtime' | 'test' }> = []

  /**
   * 分析代码上下文
   */
  async analyzeContext(metrics: BehaviorMetrics): Promise<CodeContext | null> {
    try {
      const currentFile = this.getCurrentFile()
      if (!currentFile) return null

      const fileType = this.getFileType(currentFile)
      const projectType = await this.detectProjectType()
      
      // 分析代码复杂度（简化实现）
      const codeComplexity = await this.analyzeCodeComplexity(currentFile)
      
      // 检查错误
      const { hasErrors, errorType } = await this.checkErrors()
      
      // Git状态
      const gitStatus = await this.getGitStatus()
      const recentCommits = this.getRecentCommits(60 * 60 * 1000) // 1小时
      
      // 搜索模式
      const searchQueries = this.getRecentSearchCount(60 * 60 * 1000)
      
      // AI交互模式
      const aiInteractions = this.analyzeAIInteractions(60 * 60 * 1000)

      return {
        currentFile,
        fileType,
        projectType,
        recentFiles: this.recentFiles.slice(-10),
        codeComplexity,
        hasErrors,
        errorType,
        gitStatus,
        recentCommits,
        searchQueries,
        aiInteractions,
      }
    } catch (error) {
      console.warn('[EmotionContextAnalyzer] Failed to analyze context:', error)
      return null
    }
  }

  /**
   * 记录文件切换
   */
  recordFileSwitch(filePath: string): void {
    this.recentFiles.push(filePath)
    if (this.recentFiles.length > 20) {
      this.recentFiles.shift()
    }
  }

  /**
   * 记录搜索
   */
  recordSearch(): void {
    this.searchHistory.push(Date.now())
    // 只保留最近1小时
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    this.searchHistory = this.searchHistory.filter(t => t > oneHourAgo)
  }

  /**
   * 记录AI交互
   */
  recordAIInteraction(type: 'question' | 'suggestion_accepted' | 'suggestion_rejected' | 'command', complexity: 'simple' | 'medium' | 'complex' = 'medium'): void {
    this.aiInteractionHistory.push({
      timestamp: Date.now(),
      type,
      complexity,
    })
    // 只保留最近2小时
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    this.aiInteractionHistory = this.aiInteractionHistory.filter(h => h.timestamp > twoHoursAgo)
  }

  /**
   * 记录Git活动
   */
  recordGitActivity(type: 'commit' | 'push' | 'pull'): void {
    this.gitActivityHistory.push({
      timestamp: Date.now(),
      type,
    })
    // 只保留最近24小时
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    this.gitActivityHistory = this.gitActivityHistory.filter(h => h.timestamp > oneDayAgo)
  }

  /**
   * 记录错误
   */
  recordError(type: 'syntax' | 'type' | 'runtime' | 'test'): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      type,
    })
    // 只保留最近1小时
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    this.errorHistory = this.errorHistory.filter(e => e.timestamp > oneHourAgo)
  }

  /**
   * 基于上下文增强情绪检测
   */
  enhanceEmotionDetection(
    baseState: EmotionState,
    baseIntensity: number,
    context: CodeContext | null
  ): { state: EmotionState; intensity: number; confidence: number; suggestions: string[] } {
    if (!context) {
      return { state: baseState, intensity: baseIntensity, confidence: 0.7, suggestions: [] }
    }

    let adjustedState = baseState
    let adjustedIntensity = baseIntensity
    let confidence = 0.8
    const suggestions: string[] = []

    // 1. AI交互模式分析
    if (context.aiInteractions.count > 5 && context.aiInteractions.rejectionRate > 0.5) {
      // 频繁拒绝AI建议 = 可能困惑或沮丧
      if (baseState === 'focused') adjustedState = 'frustrated'
      adjustedIntensity = Math.min(adjustedIntensity + 0.2, 1)
      suggestions.push('看起来你在尝试不同的方法，需要我帮你梳理一下思路吗？')
    } else if (context.aiInteractions.count > 3 && context.aiInteractions.rejectionRate < 0.2) {
      // 频繁接受AI建议 = 流畅状态
      if (baseState === 'focused') adjustedState = 'flow'
      adjustedIntensity = Math.min(adjustedIntensity + 0.15, 1)
    }

    // 2. 错误类型分析
    if (context.hasErrors) {
      if (context.errorType === 'syntax') {
        // 语法错误 = 可能沮丧
        if (baseState !== 'frustrated') adjustedState = 'frustrated'
        adjustedIntensity = Math.min(adjustedIntensity + 0.3, 1)
        suggestions.push('语法错误通常很容易解决，让我帮你检查一下？')
      } else if (context.errorType === 'type') {
        // 类型错误 = 可能在思考
        if (baseState === 'focused') adjustedState = 'stressed'
        adjustedIntensity = Math.min(adjustedIntensity + 0.2, 1)
      } else if (context.errorType === 'test') {
        // 测试失败 = 可能专注调试
        if (baseState === 'neutral') adjustedState = 'focused'
        suggestions.push('测试失败是发现问题的好机会，需要我帮你分析吗？')
      }
    }

    // 3. 文件类型模式
    if (context.fileType === 'test') {
      // 写测试 = 通常更自信
      if (baseState === 'focused') adjustedIntensity = Math.min(adjustedIntensity + 0.1, 1)
    } else if (context.fileType === 'config') {
      // 配置文件 = 可能更谨慎
      if (baseState === 'neutral') adjustedState = 'focused'
    }

    // 4. Git活动模式
    if (context.recentCommits > 3) {
      // 频繁提交 = 兴奋或专注
      if (baseState === 'focused' || baseState === 'excited') {
        adjustedIntensity = Math.min(adjustedIntensity + 0.15, 1)
      }
      suggestions.push('频繁提交说明进展顺利，继续保持！')
    } else if (context.recentCommits === 0 && context.gitStatus === 'modified') {
      // 有修改但没提交 = 可能卡住
      if (baseState === 'focused') adjustedState = 'stressed'
      suggestions.push('代码修改很多但还没提交？需要我帮你review一下吗？')
    }

    // 5. 搜索模式
    if (context.searchQueries > 10) {
      // 频繁搜索 = 可能困惑
      if (baseState === 'focused') adjustedState = 'frustrated'
      adjustedIntensity = Math.min(adjustedIntensity + 0.2, 1)
      suggestions.push('频繁搜索可能说明遇到了问题，需要我帮你找答案吗？')
    }

    // 6. 代码复杂度
    if (context.codeComplexity > 0.8) {
      // 高复杂度 = 可能压力大
      if (baseState === 'focused') adjustedState = 'stressed'
      adjustedIntensity = Math.min(adjustedIntensity + 0.15, 1)
      suggestions.push('这段代码复杂度较高，考虑拆分成更小的函数？')
    }

    // 提高置信度（有上下文信息）
    confidence = Math.min(confidence + 0.1, 0.95)

    return {
      state: adjustedState,
      intensity: adjustedIntensity,
      confidence,
      suggestions: suggestions.slice(0, 3), // 最多3条建议
    }
  }

  // ===== 私有辅助方法 =====

  private getCurrentFile(): string {
    // 从编辑器获取当前文件（简化实现）
    // 实际应该从编辑器API获取
    return ''
  }

  private getFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    if (ext.includes('test') || ext.includes('spec')) return 'test'
    if (['json', 'yaml', 'yml', 'toml', 'ini'].includes(ext)) return 'config'
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return 'code'
    return 'other'
  }

  private async detectProjectType(): Promise<string> {
    // 检测项目类型（简化实现）
    // 实际应该检查package.json、requirements.txt等
    return 'unknown'
  }

  private async analyzeCodeComplexity(filePath: string): Promise<number> {
    // 分析代码复杂度（简化实现）
    // 实际可以使用AST分析、圈复杂度等
    return 0.5
  }

  private async checkErrors(): Promise<{ hasErrors: boolean; errorType?: 'syntax' | 'type' | 'runtime' | 'test' }> {
    // 检查当前是否有错误（简化实现）
    // 实际应该从LSP或编辑器获取
    return { hasErrors: false }
  }

  private async getGitStatus(): Promise<'clean' | 'modified' | 'conflict'> {
    // 获取Git状态（简化实现）
    return 'clean'
  }

  private getRecentCommits(timeWindow: number): number {
    const cutoff = Date.now() - timeWindow
    return this.gitActivityHistory.filter(h => h.timestamp > cutoff && h.type === 'commit').length
  }

  private getRecentSearchCount(timeWindow: number): number {
    const cutoff = Date.now() - timeWindow
    return this.searchHistory.filter(t => t > cutoff).length
  }

  private analyzeAIInteractions(timeWindow: number): CodeContext['aiInteractions'] {
    const cutoff = Date.now() - timeWindow
    const recent = this.aiInteractionHistory.filter(h => h.timestamp > cutoff)
    
    const count = recent.length
    const accepted = recent.filter(h => h.type === 'suggestion_accepted').length
    const rejected = recent.filter(h => h.type === 'suggestion_rejected').length
    const rejectionRate = count > 0 ? rejected / count : 0
    
    // 计算平均复杂度
    const complexities = recent.map(h => {
      if (h.complexity === 'simple') return 1
      if (h.complexity === 'medium') return 2
      return 3
    })
    const avgComplexity = complexities.length > 0
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length
      : 2
    
    const questionComplexity: 'simple' | 'medium' | 'complex' =
      avgComplexity < 1.5 ? 'simple' : avgComplexity < 2.5 ? 'medium' : 'complex'

    // 计算平均响应时间（简化，实际应该记录）
    const avgResponseTime = 2000

    return {
      count,
      avgResponseTime,
      rejectionRate,
      questionComplexity,
    }
  }
}

export const emotionContextAnalyzer = new EmotionContextAnalyzer()
