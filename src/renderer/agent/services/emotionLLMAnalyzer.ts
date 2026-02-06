/**
 * LLM 辅助情绪分析器
 *
 * 用 AI 模型分析开发者行为摘要，得到比规则引擎更精准、更有洞察力的情绪判断。
 *
 * 设计原则：
 *  - 不是每 12 秒都调 LLM（太贵）— 只在"有话可说"时调用，且有最小间隔
 *  - 给 LLM 的是高度压缩的行为摘要（~200 tokens prompt），不是原始数据
 *  - 用 generateObject 拿结构化 JSON，不做文本解析
 *  - 失败时静默降级到规则引擎，零影响
 */

import { api } from '@/renderer/services/electronAPI'
import { useStore } from '@/renderer/store'
import { logger } from '@utils/Logger'
import type { EmotionState, EmotionDetection, CodeContext } from '../types/emotion'

// ===== 配置 =====
const MIN_CALL_INTERVAL = 90_000        // 最少 90 秒调一次 LLM
const LLM_TIMEOUT = 15_000              // 15 秒超时
const MAX_TOKENS = 200                  // 回复最多 200 tokens，够了
const TEMPERATURE = 0.1                 // 低随机性，稳定分类

// ===== LLM 返回的结构化结果 =====
export interface LLMEmotionResult {
  /** 判断的情绪状态 */
  state: EmotionState
  /** 强度 0-1 */
  intensity: number
  /** 置信度 0-1 */
  confidence: number
  /** 一句话推理过程（中文） */
  reasoning: string
  /** 给开发者的智能建议（中文，1条） */
  suggestion: string
}

// generateObject 的 JSON Schema
const EMOTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    state: {
      type: 'string' as const,
      enum: ['focused', 'frustrated', 'tired', 'excited', 'bored', 'stressed', 'flow', 'neutral'],
      description: 'The detected developer emotion state',
    },
    intensity: {
      type: 'number' as const,
      description: 'Emotion intensity from 0.0 to 1.0',
    },
    confidence: {
      type: 'number' as const,
      description: 'How confident you are in this assessment, from 0.0 to 1.0',
    },
    reasoning: {
      type: 'string' as const,
      description: 'One-sentence reasoning in Chinese explaining why you chose this state',
    },
    suggestion: {
      type: 'string' as const,
      description: 'One actionable suggestion for the developer in Chinese, based on their current state',
    },
  },
  required: ['state', 'intensity', 'confidence', 'reasoning', 'suggestion'],
}

const SYSTEM_PROMPT = `你是一个嵌入在 AI 代码编辑器中的开发者情绪感知引擎。
你的任务是根据行为数据摘要判断开发者当前的情绪状态。

可用状态：
- focused: 专注高效编码
- frustrated: 遇到困难/频繁出错/卡住
- tired: 长时间工作/反应变慢
- excited: 快速编码/充满能量
- bored: 重复性工作/缺乏挑战
- stressed: 多线程工作/紧急任务/压力大
- flow: 深度沉浸心流状态
- neutral: 正常平稳工作

判断规则：
1. 综合所有信号而不是只看单一指标
2. 行为变化比绝对值更重要（速度突然下降 vs 一直很慢）
3. 上下文很关键：有 LSP 错误 + 打字速度下降 = frustrated，而不是 tired
4. 建议要具体、可操作，不要空洞的鼓励
5. 回答简洁，reasoning 一句话，suggestion 一句话`

class EmotionLLMAnalyzer {
  private lastCallTime = 0
  private lastResult: LLMEmotionResult | null = null
  private pendingCall: Promise<LLMEmotionResult | null> | null = null
  private callCount = 0

  /**
   * 尝试用 LLM 分析情绪
   *
   * 返回 null 表示：冷却中 / 无数据 / LLM 不可用 / 调用失败
   * 调用方应该在拿到 null 时使用规则引擎的结果
   */
  async analyze(
    ruleBasedDetection: EmotionDetection,
    context: CodeContext | null,
    behaviorSummary: BehaviorSummary
  ): Promise<LLMEmotionResult | null> {
    // ———— 冷却检查 ————
    const now = Date.now()
    const elapsed = now - this.lastCallTime
    if (elapsed < MIN_CALL_INTERVAL) return this.lastResult

    // ———— 数据充足性检查 ————
    if (!this.hasEnoughDataToAnalyze(behaviorSummary, context)) {
      // 如果超过最大间隔了，也不强制调（没数据调了也白调）
      return this.lastResult
    }

    // ———— LLM 配置检查 ————
    const { llmConfig } = useStore.getState()
    if (!llmConfig?.apiKey || !llmConfig?.model) {
      return null // 没配置 LLM，静默跳过
    }

    // ———— 防并发 ————
    if (this.pendingCall) return this.lastResult

    // ———— 发起 LLM 调用 ————
    this.pendingCall = this.callLLM(ruleBasedDetection, context, behaviorSummary, llmConfig)
    try {
      const result = await this.pendingCall
      if (result) {
        this.lastResult = result
        this.lastCallTime = now
        this.callCount++
        logger.agent.info(
          '[EmotionLLM] #%d → %s (%.0f%% conf): %s',
          this.callCount, result.state,
          result.confidence * 100, result.reasoning,
        )
      }
      return result
    } catch (err) {
      logger.agent.warn('[EmotionLLM] Call failed:', err)
      return this.lastResult
    } finally {
      this.pendingCall = null
    }
  }

  /**
   * 获取上一次 LLM 分析结果（用于 UI 展示推理过程）
   */
  getLastResult(): LLMEmotionResult | null {
    return this.lastResult
  }

  /**
   * 获取调用统计
   */
  getStats(): { callCount: number; lastCallTime: number } {
    return { callCount: this.callCount, lastCallTime: this.lastCallTime }
  }

  // ===== 私有方法 =====

  private hasEnoughDataToAnalyze(summary: BehaviorSummary, context: CodeContext | null): boolean {
    // 至少要有一些行为数据
    if (summary.totalKeystrokes === 0 && summary.sessionMinutes < 1 && !context?.hasErrors) {
      return false
    }
    return true
  }

  private async callLLM(
    ruleDetection: EmotionDetection,
    context: CodeContext | null,
    summary: BehaviorSummary,
    llmConfig: { provider: string; model: string; apiKey: string; baseUrl?: string; timeout?: number }
  ): Promise<LLMEmotionResult | null> {
    const prompt = this.buildPrompt(ruleDetection, context, summary)

    try {
      const result = await api.llm.generateObject({
        config: {
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: llmConfig.apiKey,
          baseUrl: llmConfig.baseUrl,
          timeout: LLM_TIMEOUT,
          maxTokens: MAX_TOKENS,
          temperature: TEMPERATURE,
        },
        schema: EMOTION_SCHEMA,
        system: SYSTEM_PROMPT,
        prompt,
      })

      if (result.error) {
        logger.agent.warn('[EmotionLLM] API error:', result.error)
        return null
      }

      const obj = result.object as LLMEmotionResult | undefined
      if (!obj || !obj.state) return null

      // 校验范围
      return {
        state: obj.state,
        intensity: clamp(obj.intensity, 0, 1),
        confidence: clamp(obj.confidence, 0, 1),
        reasoning: obj.reasoning || '',
        suggestion: obj.suggestion || '',
      }
    } catch (err) {
      logger.agent.warn('[EmotionLLM] generateObject failed:', err)
      return null
    }
  }

  /**
   * 构建给 LLM 的行为摘要（尽量精简，控制 token 消耗）
   */
  private buildPrompt(
    ruleDetection: EmotionDetection,
    context: CodeContext | null,
    summary: BehaviorSummary
  ): string {
    const lines: string[] = []

    lines.push(`## 开发者行为摘要（最近 ${summary.windowMinutes} 分钟）`)
    lines.push('')

    // 基础行为
    lines.push(`打字速度: ${summary.avgTypingSpeed.toFixed(0)} WPM`)
    lines.push(`退格率: ${(summary.backspaceRate * 100).toFixed(0)}%`)
    lines.push(`总击键: ${summary.totalKeystrokes}`)
    lines.push(`停顿时长: ${(summary.pauseDurationSec).toFixed(0)}s`)
    lines.push(`文件切换: ${summary.fileSwitches} 次`)
    lines.push(`会话时长: ${summary.sessionMinutes.toFixed(0)} 分钟`)
    lines.push(`当前时间: ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`)

    // 上下文（如果有）
    if (context) {
      lines.push('')
      lines.push(`## 环境上下文`)
      lines.push(`当前文件: ${context.currentFile.split('/').pop() || 'unknown'} (${context.fileType})`)
      if (context.hasErrors) {
        lines.push(`⚠ 当前文件有 ${context.errorType || ''} 错误`)
      }
      if (context.gitStatus && context.gitStatus !== 'clean') {
        lines.push(`Git: ${context.gitStatus}`)
      }
      if (context.aiInteractions.count > 0) {
        lines.push(`AI 交互: ${context.aiInteractions.count} 次, 平均响应 ${(context.aiInteractions.avgResponseTime / 1000).toFixed(1)}s`)
      }
      if (context.codeComplexity > 0.5) {
        lines.push(`代码复杂度: ${(context.codeComplexity * 100).toFixed(0)}% (较高)`)
      }
    }

    // 规则引擎的初步判断（让 LLM 参考但可以推翻）
    lines.push('')
    lines.push(`## 规则引擎初步判断`)
    lines.push(`状态: ${ruleDetection.state}, 强度: ${ruleDetection.intensity.toFixed(2)}, 置信度: ${ruleDetection.confidence.toFixed(2)}`)
    const topFactors = ruleDetection.factors.slice(0, 4).map(f => f.description).join(', ')
    if (topFactors) {
      lines.push(`主要因素: ${topFactors}`)
    }

    lines.push('')
    lines.push(`请综合以上信息，给出你的独立判断。你可以同意规则引擎，也可以推翻它。`)

    return lines.join('\n')
  }
}

// ===== 行为摘要结构（引擎聚合后传给 LLM） =====
export interface BehaviorSummary {
  windowMinutes: number
  avgTypingSpeed: number        // WPM
  backspaceRate: number         // 0-1
  totalKeystrokes: number
  pauseDurationSec: number
  fileSwitches: number
  sessionMinutes: number
  copyPasteCount: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export const emotionLLMAnalyzer = new EmotionLLMAnalyzer()
