/**
 * 代码分块服务
 * 将代码文件分割成适合 embedding 的块
 */

import * as path from 'path'
import { CodeChunk, IndexConfig, DEFAULT_INDEX_CONFIG } from './types'

// 语言映射
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript',
  py: 'python', pyw: 'python',
  go: 'go', rs: 'rust', java: 'java',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  cs: 'csharp', rb: 'ruby', php: 'php',
  swift: 'swift', kt: 'kotlin', scala: 'scala',
  vue: 'vue', svelte: 'svelte',
}

// 函数/类定义的正则模式
const FUNCTION_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
    /^(?:export\s+)?class\s+(\w+)/,
    /^(?:export\s+)?interface\s+(\w+)/,
    /^(?:export\s+)?type\s+(\w+)/,
    /^\s*(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/,
  ],
  javascript: [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
    /^(?:export\s+)?class\s+(\w+)/,
  ],
  python: [
    /^(?:async\s+)?def\s+(\w+)/,
    /^class\s+(\w+)/,
  ],
  go: [
    /^func\s+(?:\([^)]+\)\s+)?(\w+)/,
    /^type\s+(\w+)\s+struct/,
    /^type\s+(\w+)\s+interface/,
  ],
  rust: [
    /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
    /^(?:pub\s+)?struct\s+(\w+)/,
    /^(?:pub\s+)?enum\s+(\w+)/,
    /^(?:pub\s+)?trait\s+(\w+)/,
    /^impl(?:<[^>]+>)?\s+(\w+)/,
  ],
  java: [
    /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)/,
    /^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(/,
  ],
  cpp: [
    /^(?:class|struct)\s+(\w+)/,
    /^(?:\w+(?:<[^>]+>)?(?:\s*\*)?)\s+(\w+)\s*\([^)]*\)\s*(?:const)?\s*[{;]/,
  ],
}

export class ChunkerService {
  private config: IndexConfig

  constructor(config?: Partial<IndexConfig>) {
    this.config = { ...DEFAULT_INDEX_CONFIG, ...config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IndexConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 分块单个文件
   */
  chunkFile(filePath: string, content: string, workspacePath: string): CodeChunk[] {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const language = LANGUAGE_MAP[ext] || ext
    const relativePath = path.relative(workspacePath, filePath)
    const lines = content.split('\n')

    // 小文件：整体作为一个 chunk
    if (lines.length <= this.config.chunkSize * 1.5) {
      return [{
        id: this.generateId(filePath, 0),
        filePath,
        relativePath,
        content,
        startLine: 1,
        endLine: lines.length,
        type: 'file',
        language,
        symbols: this.extractSymbols(content, language),
      }]
    }

    // 大文件：尝试按函数/类分块，否则按行数分块
    const semanticChunks = this.chunkBySemantic(filePath, content, workspacePath, language)
    
    if (semanticChunks.length > 0) {
      return semanticChunks
    }

    // 回退到按行数分块
    return this.chunkByLines(filePath, content, workspacePath, language)
  }

  /**
   * 按语义边界分块（函数、类等）
   */
  private chunkBySemantic(
    filePath: string,
    content: string,
    workspacePath: string,
    language: string
  ): CodeChunk[] {
    const patterns = FUNCTION_PATTERNS[language]
    if (!patterns) return []

    const lines = content.split('\n')
    const relativePath = path.relative(workspacePath, filePath)
    const chunks: CodeChunk[] = []
    const boundaries: { line: number; symbol: string; type: 'function' | 'class' }[] = []

    // 找到所有函数/类的起始位置
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const pattern of patterns) {
        const match = line.match(pattern)
        if (match) {
          const isClass = /class|struct|interface|trait|enum|type/.test(line)
          boundaries.push({
            line: i,
            symbol: match[1],
            type: isClass ? 'class' : 'function',
          })
          break
        }
      }
    }

    if (boundaries.length === 0) return []

    // 根据边界创建 chunks
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i].line
      const end = i < boundaries.length - 1 
        ? boundaries[i + 1].line - 1 
        : lines.length - 1

      // 跳过太小的块
      if (end - start < 3) continue

      const chunkContent = lines.slice(start, end + 1).join('\n')
      
      // 如果块太大，进一步分割
      if (end - start > this.config.chunkSize * 2) {
        const subChunks = this.chunkByLines(
          filePath,
          chunkContent,
          workspacePath,
          language,
          start + 1
        )
        chunks.push(...subChunks)
      } else {
        chunks.push({
          id: this.generateId(filePath, start),
          filePath,
          relativePath,
          content: chunkContent,
          startLine: start + 1,
          endLine: end + 1,
          type: boundaries[i].type,
          language,
          symbols: [boundaries[i].symbol],
        })
      }
    }

    return chunks
  }

  /**
   * 按行数分块（带重叠）
   */
  private chunkByLines(
    filePath: string,
    content: string,
    workspacePath: string,
    language: string,
    baseLineNumber: number = 1
  ): CodeChunk[] {
    const lines = content.split('\n')
    const relativePath = path.relative(workspacePath, filePath)
    const chunks: CodeChunk[] = []
    const { chunkSize, chunkOverlap } = this.config

    for (let i = 0; i < lines.length; i += chunkSize - chunkOverlap) {
      const start = i
      const end = Math.min(i + chunkSize, lines.length)
      const chunkContent = lines.slice(start, end).join('\n')

      // 跳过空块
      if (chunkContent.trim().length === 0) continue

      chunks.push({
        id: this.generateId(filePath, baseLineNumber + start - 1),
        filePath,
        relativePath,
        content: chunkContent,
        startLine: baseLineNumber + start,
        endLine: baseLineNumber + end - 1,
        type: 'block',
        language,
        symbols: this.extractSymbols(chunkContent, language),
      })

      if (end >= lines.length) break
    }

    return chunks
  }

  /**
   * 提取代码中的符号（函数名、类名等）
   */
  private extractSymbols(content: string, language: string): string[] {
    const patterns = FUNCTION_PATTERNS[language] || FUNCTION_PATTERNS.typescript
    const symbols: string[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern)
        if (match && match[1]) {
          symbols.push(match[1])
        }
      }
    }

    return [...new Set(symbols)]
  }

  /**
   * 生成唯一 ID
   */
  private generateId(filePath: string, lineNumber: number): string {
    return `${filePath}:${lineNumber}`
  }

  /**
   * 检查文件是否应该被索引
   */
  shouldIndexFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.config.includedExts.includes(ext)
  }

  /**
   * 检查目录是否应该被忽略
   */
  shouldIgnoreDir(dirName: string): boolean {
    return this.config.ignoredDirs.includes(dirName) || dirName.startsWith('.')
  }
}
