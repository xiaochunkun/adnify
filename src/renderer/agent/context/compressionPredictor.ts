/**
 * 压缩等级预测器
 * 
 * 根据历史数据预测最佳压缩等级，避免每次都从 L0 开始尝试
 * 支持持久化，重启后保留历史数据
 */

import { logger } from '@utils/Logger'
import type { CompressionLevel } from './CompressionManager'

interface CompressionRecord {
  messageCount: number
  contextSize: number
  appliedLevel: CompressionLevel
  timestamp: number
}

const STORAGE_KEY = 'compressionPredictorHistory'

export class CompressionPredictor {
  private history: CompressionRecord[] = []
  private maxHistorySize = 50
  private initialized = false

  constructor() {
    // 延迟加载，避免在构造函数中访问 localStorage
    this.loadHistory()
  }

  /**
   * 从 localStorage 加载历史数据
   */
  private loadHistory(): void {
    if (this.initialized) return
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as CompressionRecord[]
        
        // 过滤掉过期的记录（超过 7 天）
        const now = Date.now()
        const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 天
        this.history = parsed.filter(r => now - r.timestamp < maxAge)
        
        logger.agent.info(`[CompressionPredictor] Loaded ${this.history.length} records from storage`)
      }
    } catch (e) {
      logger.agent.warn('[CompressionPredictor] Failed to load history:', e)
      this.history = []
    }
    
    this.initialized = true
  }

  /**
   * 保存历史数据到 localStorage
   */
  private saveHistory(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history))
    } catch (e) {
      logger.agent.warn('[CompressionPredictor] Failed to save history:', e)
    }
  }

  /**
   * 根据历史数据预测最佳压缩等级
   * 
   * @param messageCount 消息数量
   * @param contextSize 上下文大小（字符数）
   * @returns 预测的压缩等级
   */
  predictLevel(messageCount: number, contextSize: number): CompressionLevel {
    this.loadHistory() // 确保已加载
    
    if (this.history.length < 3) {
      // 历史数据不足，从 L0 开始
      return 0
    }

    // 找到相似的历史记录（消息数量 ±5，上下文大小 ±5000）
    const similar = this.history.filter(h =>
      Math.abs(h.messageCount - messageCount) <= 5 &&
      Math.abs(h.contextSize - contextSize) < 5000
    )

    if (similar.length === 0) {
      // 没有相似记录，使用全局平均值
      const avgLevel = this.history.reduce((sum, h) => sum + h.appliedLevel, 0) / this.history.length
      const predicted = Math.floor(avgLevel) as CompressionLevel
      logger.agent.debug(`[CompressionPredictor] No similar records, using global avg: L${predicted}`)
      return predicted
    }

    // 计算相似记录的加权平均（越新的记录权重越高）
    const now = Date.now()
    let weightedSum = 0
    let totalWeight = 0

    for (const record of similar) {
      // 时间衰减：1小时内权重 1.0，每小时衰减 10%
      const ageHours = (now - record.timestamp) / (1000 * 60 * 60)
      const weight = Math.max(0.3, 1.0 - ageHours * 0.1)
      
      weightedSum += record.appliedLevel * weight
      totalWeight += weight
    }

    const avgLevel = weightedSum / totalWeight
    
    // 向上取整（保守策略，避免压缩不足）
    const predicted = Math.min(Math.ceil(avgLevel), 4) as CompressionLevel
    
    logger.agent.info(
      `[CompressionPredictor] Predicted L${predicted} ` +
      `(${similar.length} similar records, avg: ${avgLevel.toFixed(2)})`
    )

    return predicted
  }

  /**
   * 记录本次压缩结果
   * 
   * @param messageCount 消息数量
   * @param contextSize 上下文大小
   * @param appliedLevel 实际应用的压缩等级
   */
  record(messageCount: number, contextSize: number, appliedLevel: CompressionLevel): void {
    this.loadHistory() // 确保已加载
    
    this.history.push({
      messageCount,
      contextSize,
      appliedLevel,
      timestamp: Date.now(),
    })

    // 保持历史大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    // 持久化
    this.saveHistory()

    logger.agent.debug(
      `[CompressionPredictor] Recorded: messages=${messageCount}, ` +
      `context=${contextSize}, level=L${appliedLevel}`
    )
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = []
    this.saveHistory()
    logger.agent.info('[CompressionPredictor] History cleared')
  }

  /**
   * 获取统计信息
   */
  getStats() {
    this.loadHistory() // 确保已加载
    
    if (this.history.length === 0) {
      return {
        recordCount: 0,
        avgLevel: 0,
        levelDistribution: {},
      }
    }

    const avgLevel = this.history.reduce((sum, h) => sum + h.appliedLevel, 0) / this.history.length

    // 统计各等级的分布
    const distribution: Record<number, number> = {}
    for (const record of this.history) {
      distribution[record.appliedLevel] = (distribution[record.appliedLevel] || 0) + 1
    }

    return {
      recordCount: this.history.length,
      avgLevel: avgLevel.toFixed(2),
      levelDistribution: distribution,
    }
  }
}

// 导出单例
export const compressionPredictor = new CompressionPredictor()
