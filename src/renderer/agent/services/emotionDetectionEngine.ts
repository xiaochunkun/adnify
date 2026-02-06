/**
 * 情绪检测引擎
 * 通过分析开发者行为模式检测情绪状态
 */

import { logger } from '@utils/Logger'
import { EventBus } from '../core/EventBus'
import type {
  EmotionState,
  EmotionDetection,
  EmotionFactor,
  BehaviorMetrics,
  EmotionHistory,
} from '../types/emotion'

// 检测窗口配置
const DETECTION_WINDOW = 15000   // 15秒分析窗口（原来30秒太慢）
const SAMPLE_INTERVAL = 5000     // 每5秒采样一次指标
const METRICS_BUFFER_SIZE = 100
const HISTORY_LIMIT = 1440       // 保存24小时的历史

class EmotionDetectionEngine {
  private metricsBuffer: BehaviorMetrics[] = []
  private history: EmotionHistory[] = []
  private currentState: EmotionDetection | null = null
  private stateStartTime = Date.now()
  private _lastActivityTime = Date.now()

  // 定时器
  private typingTimer: NodeJS.Timeout | null = null
  private pauseTimer: NodeJS.Timeout | null = null
  private analysisTimer: NodeJS.Timeout | null = null
  private samplingTimer: NodeJS.Timeout | null = null

  // 运行状态
  private isRunning = false
  private isTyping = false
  private currentFile = ''
  private currentProject = ''

  // 实时计数器（在采样间隔内累积，每次采样时写入指标块）
  private liveCounters = {
    keystrokes: 0,
    backspaces: 0,
    cursorMoves: 0,
    copyPastes: 0,
    fileSwitches: 0,
    testRuns: 0,
    testFailures: 0,
  }

  // 事件监听器引用
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null
  private mousemoveHandler: (() => void) | null = null
  private blurHandler: (() => void) | null = null
  private focusHandler: (() => void) | null = null

  /**
   * 启动检测引擎（防重入）
   */
  start(): void {
    if (this.isRunning) return
    this.isRunning = true

    this.setupEventListeners()
    this.startSampling()
    this.startPeriodicAnalysis()

    // 立即发射初始状态，不让 UI 等 15 秒
    this.emitInitialState()

    logger.agent.info('[EmotionEngine] Started')
  }

  /**
   * 停止检测引擎
   */
  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    this.cleanup()
    logger.agent.info('[EmotionEngine] Stopped')
  }

  // ===== 记录方法（外部调用） =====

  recordKeystroke(key: string): void {
    this._lastActivityTime = Date.now()
    this.liveCounters.keystrokes++
    if (key === 'Backspace' || key === 'Delete') {
      this.liveCounters.backspaces++
    }
    this.handleTypingStart()
  }

  recordCursorMovement(): void {
    this.liveCounters.cursorMoves++
  }

  recordCopyPaste(): void {
    this.liveCounters.copyPastes++
  }

  recordFileSwitch(filePath: string): void {
    this.currentFile = filePath
    this.liveCounters.fileSwitches++
  }

  recordTestRun(failed: number, _total: number): void {
    this.liveCounters.testRuns++
    this.liveCounters.testFailures += failed
  }

  recordSave(): void {
    // 未来扩展
  }

  recordError(): void {
    // 未来扩展
  }

  getCurrentState(): EmotionDetection | null {
    return this.currentState
  }

  getHistory(duration: number = 24 * 60 * 60 * 1000): EmotionHistory[] {
    const cutoff = Date.now() - duration
    return this.history.filter(h => h.timestamp > cutoff)
  }

  getProductivityReport(): {
    focusTime: number
    flowSessions: number
    frustrationEpisodes: number
    breakRecommendations: number
    mostProductiveHour: number
  } {
    const dayHistory = this.getHistory(24 * 60 * 60 * 1000)

    const focusTime = dayHistory.filter(h =>
      h.state === 'focused' || h.state === 'flow'
    ).length * (DETECTION_WINDOW / 1000 / 60)

    let flowSessions = 0
    let inFlowSession = false
    for (const h of dayHistory) {
      if (h.state === 'flow' && !inFlowSession) {
        flowSessions++
        inFlowSession = true
      } else if (h.state !== 'flow') {
        inFlowSession = false
      }
    }

    const frustrationEpisodes = dayHistory.filter(h => h.state === 'frustrated').length
    const breakRecommendations = dayHistory.filter(h => h.state === 'tired').length

    const hourlyProductivity = new Array(24).fill(0)
    for (const h of dayHistory) {
      if (h.state === 'focused' || h.state === 'flow') {
        const hour = new Date(h.timestamp).getHours()
        hourlyProductivity[hour]++
      }
    }
    const mostProductiveHour = hourlyProductivity.indexOf(Math.max(...hourlyProductivity))

    return { focusTime, flowSessions, frustrationEpisodes, breakRecommendations, mostProductiveHour }
  }

  // ===== 私有方法 =====

  private setupEventListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => this.recordKeystroke(e.key)
    this.mousemoveHandler = () => { this._lastActivityTime = Date.now() }
    this.blurHandler = () => this.handlePause()
    this.focusHandler = () => { this._lastActivityTime = Date.now() }

    window.addEventListener('keydown', this.keydownHandler)
    window.addEventListener('mousemove', this.mousemoveHandler)
    window.addEventListener('blur', this.blurHandler)
    window.addEventListener('focus', this.focusHandler)
  }

  /**
   * 定期采样（每5秒创建一个指标快照）
   * 这是关键！确保分析窗口内有足够的数据点
   */
  private startSampling(): void {
    // 立即创建第一个指标块
    this.flushCountersToMetrics()

    this.samplingTimer = setInterval(() => {
      this.flushCountersToMetrics()
    }, SAMPLE_INTERVAL)
  }

  /**
   * 把实时计数器写入一个指标快照
   */
  private flushCountersToMetrics(): void {
    const metrics: BehaviorMetrics = {
      timestamp: Date.now(),
      typingSpeed: 0,  // 在聚合时计算
      errorRate: 0,     // 在聚合时计算
      activeTypingTime: this.isTyping ? Date.now() : 0,
      pauseDuration: this.getCurrentPauseDuration(),
      keystrokes: this.liveCounters.keystrokes,
      backspaceRate: this.liveCounters.backspaces,
      cursorMovement: this.liveCounters.cursorMoves,
      copyPasteCount: this.liveCounters.copyPastes,
      fileSwitches: this.liveCounters.fileSwitches,
      testRuns: this.liveCounters.testRuns,
      testFailures: this.liveCounters.testFailures,
    }

    this.metricsBuffer.push(metrics)
    if (this.metricsBuffer.length > METRICS_BUFFER_SIZE) {
      this.metricsBuffer.shift()
    }

    // 重置计数器
    this.liveCounters = {
      keystrokes: 0,
      backspaces: 0,
      cursorMoves: 0,
      copyPastes: 0,
      fileSwitches: 0,
      testRuns: 0,
      testFailures: 0,
    }
  }

  private pauseStartTime: number | null = null

  private getCurrentPauseDuration(): number {
    return this.pauseStartTime ? Date.now() - this.pauseStartTime : 0
  }

  private handleTypingStart(): void {
    this.isTyping = true
    this.pauseStartTime = null  // 停止暂停计时

    // 清除之前的打字停止检测
    if (this.typingTimer) clearTimeout(this.typingTimer)

    // 2秒无输入 → 视为停顿
    this.typingTimer = setTimeout(() => {
      this.isTyping = false
      this.handlePause()
    }, 2000)
  }

  private handlePause(): void {
    this.pauseStartTime = Date.now()
  }

  private startPeriodicAnalysis(): void {
    if (this.analysisTimer) clearInterval(this.analysisTimer)

    this.analysisTimer = setInterval(() => {
      this.analyzeAndDetect()
    }, DETECTION_WINDOW)
  }

  /**
   * 启动时立即发射初始状态
   */
  private emitInitialState(): void {
    const detection: EmotionDetection = {
      state: 'neutral',
      intensity: 0.5,
      confidence: 0.3,
      triggeredAt: Date.now(),
      duration: 0,
      factors: [{
        type: 'session_duration',
        weight: 1,
        value: 0,
        description: 'Session just started',
      }],
    }

    this.currentState = detection
    this.stateStartTime = Date.now()
    this.recordHistory(detection)

    EventBus.emit({ type: 'emotion:changed', emotion: detection })
  }

  private analyzeAndDetect(): void {
    const windowStart = Date.now() - DETECTION_WINDOW
    const recentMetrics = this.metricsBuffer.filter(m => m.timestamp > windowStart)

    // 至少需要1个指标点（不再要求2个）
    if (recentMetrics.length === 0) return

    const aggregated = this.aggregateMetrics(recentMetrics)
    const detection = this.detectEmotion(aggregated)

    // 始终更新 currentState（但只在变化时广播事件）
    const shouldBroadcast = this.shouldNotifyStateChange(detection)
    this.currentState = detection

    if (shouldBroadcast) {
      this.stateStartTime = Date.now()
      this.recordHistory(detection)
      EventBus.emit({ type: 'emotion:changed', emotion: detection })

      logger.agent.info('[EmotionEngine] State:', detection.state,
        `intensity=${detection.intensity.toFixed(2)}`,
        `confidence=${detection.confidence.toFixed(2)}`,
        `metrics=${recentMetrics.length} samples`
      )
    }
  }

  private aggregateMetrics(metrics: BehaviorMetrics[]): BehaviorMetrics {
    if (metrics.length === 0) {
      return this.createEmptyMetrics()
    }

    const sum = (key: keyof BehaviorMetrics) =>
      metrics.reduce((acc, m) => acc + (m[key] as number), 0)

    // 计算打字速度 (WPM)
    const totalKeystrokes = sum('keystrokes')
    const timeSpanMs = metrics.length > 1
      ? metrics[metrics.length - 1].timestamp - metrics[0].timestamp
      : SAMPLE_INTERVAL
    const timeSpanMin = Math.max(timeSpanMs / 1000 / 60, 0.01)
    const typingSpeed = (totalKeystrokes / 5) / timeSpanMin

    // 计算错误率
    const totalBackspaces = sum('backspaceRate')
    const errorRate = totalKeystrokes > 0 ? totalBackspaces / totalKeystrokes : 0

    // 停顿时间取最后一个采样的值
    const lastPause = metrics[metrics.length - 1].pauseDuration

    return {
      timestamp: Date.now(),
      typingSpeed: Math.min(typingSpeed, 150),
      errorRate,
      activeTypingTime: sum('activeTypingTime'),
      pauseDuration: lastPause,
      keystrokes: totalKeystrokes,
      backspaceRate: totalBackspaces,
      cursorMovement: sum('cursorMovement'),
      copyPasteCount: sum('copyPasteCount'),
      fileSwitches: sum('fileSwitches'),
      testRuns: sum('testRuns'),
      testFailures: sum('testFailures'),
    }
  }

  private createEmptyMetrics(): BehaviorMetrics {
    return {
      timestamp: Date.now(), typingSpeed: 0, errorRate: 0,
      activeTypingTime: 0, pauseDuration: 0, keystrokes: 0,
      backspaceRate: 0, cursorMovement: 0, copyPasteCount: 0,
      fileSwitches: 0, testRuns: 0, testFailures: 0,
    }
  }

  private detectEmotion(metrics: BehaviorMetrics): EmotionDetection {
    const factors: EmotionFactor[] = []
    const scores: Record<EmotionState, number> = {
      focused: 0, frustrated: 0, tired: 0, excited: 0,
      bored: 0, stressed: 0, flow: 0, neutral: 0.3,
    }

    // 1. 打字速度
    const typingSpeedScore = this.normalizeTypingSpeed(metrics.typingSpeed)
    factors.push({
      type: 'typing_speed', weight: 0.3, value: typingSpeedScore,
      description: `${metrics.typingSpeed.toFixed(0)} WPM`,
    })
    scores.focused   += typingSpeedScore * 0.7
    scores.excited   += typingSpeedScore * 0.9
    scores.flow      += typingSpeedScore * 0.8
    scores.tired     -= typingSpeedScore * 0.5
    scores.bored     -= typingSpeedScore * 0.6

    // 2. 错误率
    const errorRateScore = metrics.errorRate
    factors.push({
      type: 'error_rate', weight: 0.25, value: errorRateScore,
      description: `Errors: ${(errorRateScore * 100).toFixed(0)}%`,
    })
    scores.frustrated += errorRateScore * 0.8
    scores.tired      += errorRateScore * 0.4
    scores.stressed   += errorRateScore * 0.5
    scores.focused    -= errorRateScore * 0.3
    scores.flow       -= errorRateScore * 0.4

    // 3. 停顿
    const pauseScore = Math.min(metrics.pauseDuration / 30000, 1)
    factors.push({
      type: 'pause_duration', weight: 0.2, value: pauseScore,
      description: `Pause: ${(metrics.pauseDuration / 1000).toFixed(0)}s`,
    })
    scores.tired  += pauseScore * 0.6
    scores.bored  += pauseScore * 0.5
    scores.flow   -= pauseScore * 0.6

    // 4. 文件切换
    const tabSwitchScore = Math.min(metrics.fileSwitches / 3, 1)
    factors.push({
      type: 'tab_switching', weight: 0.15, value: tabSwitchScore,
      description: `Switches: ${metrics.fileSwitches}`,
    })
    scores.stressed += tabSwitchScore * 0.7
    scores.focused  -= tabSwitchScore * 0.5
    scores.flow     -= tabSwitchScore * 0.6

    // 5. 工作时长
    const sessionDuration = Date.now() - this.stateStartTime
    const sessionScore = Math.min(sessionDuration / (2 * 60 * 60 * 1000), 1)
    factors.push({
      type: 'session_duration', weight: 0.1, value: sessionScore,
      description: `${(sessionDuration / 1000 / 60).toFixed(0)}min`,
    })
    scores.tired += sessionScore * 0.5
    scores.flow  += sessionScore * 0.3

    // 6. 时间段
    const hour = new Date().getHours()
    const isLate = hour < 6 || hour > 22
    const timeScore = isLate ? 0.8 : 0.2
    factors.push({
      type: 'time_of_day', weight: 0.1, value: timeScore,
      description: `${hour}:00`,
    })
    scores.tired += timeScore * 0.5

    // 7. 活跃度（有没有在操作）
    const idleDuration = Date.now() - this._lastActivityTime
    if (idleDuration > 60000) {
      // 超过1分钟无活动
      scores.bored += 0.4
      scores.tired += 0.3
      scores.focused -= 0.3
      scores.flow -= 0.5
    }

    // 找出最高分
    let detectedState: EmotionState = 'neutral'
    let maxScore = scores.neutral
    for (const [state, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        detectedState = state as EmotionState
      }
    }

    const intensity = Math.min(Math.max(maxScore, 0), 1)
    const confidence = Math.min(factors.length / 4, 1) * (0.5 + intensity * 0.5)

    return {
      state: detectedState,
      intensity,
      confidence,
      triggeredAt: Date.now(),
      duration: Date.now() - this.stateStartTime,
      factors,
    }
  }

  private normalizeTypingSpeed(wpm: number): number {
    if (wpm < 10) return 0.1
    if (wpm < 20) return 0.2
    if (wpm < 40) return 0.4
    if (wpm < 60) return 0.6
    if (wpm < 80) return 0.8
    return 1.0
  }

  private shouldNotifyStateChange(newDetection: EmotionDetection): boolean {
    if (!this.currentState) return true
    if (this.currentState.state !== newDetection.state) return true
    // 同一状态下，强度变化超过 0.15 也通知（原来0.3太迟钝）
    return Math.abs(this.currentState.intensity - newDetection.intensity) > 0.15
  }

  private recordHistory(detection: EmotionDetection): void {
    this.history.push({
      timestamp: detection.triggeredAt,
      state: detection.state,
      intensity: detection.intensity,
      project: this.currentProject,
      file: this.currentFile,
    })
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift()
    }
  }

  private cleanup(): void {
    if (this.typingTimer) { clearTimeout(this.typingTimer); this.typingTimer = null }
    if (this.pauseTimer) { clearInterval(this.pauseTimer); this.pauseTimer = null }
    if (this.analysisTimer) { clearInterval(this.analysisTimer); this.analysisTimer = null }
    if (this.samplingTimer) { clearInterval(this.samplingTimer); this.samplingTimer = null }

    if (this.keydownHandler) { window.removeEventListener('keydown', this.keydownHandler); this.keydownHandler = null }
    if (this.mousemoveHandler) { window.removeEventListener('mousemove', this.mousemoveHandler); this.mousemoveHandler = null }
    if (this.blurHandler) { window.removeEventListener('blur', this.blurHandler); this.blurHandler = null }
    if (this.focusHandler) { window.removeEventListener('focus', this.focusHandler); this.focusHandler = null }
  }
}

export const emotionDetectionEngine = new EmotionDetectionEngine()
