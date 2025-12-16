/**
 * 向量存储服务
 * 使用 LanceDB 存储和检索代码向量
 */

import * as path from 'path'
import * as fs from 'fs'
import { IndexedChunk, SearchResult } from './types'

// Stub types
type LanceDBConnection = any
type LanceDBTable = any
type LanceDBSearchResult = any

export class VectorStoreService {
  private db: LanceDBConnection | null = null
  private table: LanceDBTable | null = null
  private indexPath: string
  private tableName = 'code_chunks'

  constructor(workspacePath: string) {
    this.indexPath = path.join(workspacePath, '.adnify', 'index')
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    if (!fs.existsSync(this.indexPath)) {
      fs.mkdirSync(this.indexPath, { recursive: true })
    }

    // LanceDB disabled due to missing dependency
    console.warn('[VectorStore] LanceDB dependency missing. Vector store disabled.')
    
    /* 
    try {
        const lancedb = await import('@lancedb/lancedb')
        this.db = await lancedb.connect(this.indexPath)

        // 检查是否已有表
        const tables = await this.db.tableNames()
        if (tables.includes(this.tableName)) {
            this.table = await this.db.openTable(this.tableName)
        }
    } catch (e) {
        console.warn('LanceDB not available, vector store disabled.')
    }
    */
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.db !== null
  }

  /**
   * 检查是否有索引数据
   */
  async hasIndex(): Promise<boolean> {
    if (!this.table) return false
    const count = await this.table.countRows()
    return count > 0
  }

  /**
   * 获取索引统计
   */
  async getStats(): Promise<{ chunkCount: number; fileCount: number }> {
    if (!this.table) {
      return { chunkCount: 0, fileCount: 0 }
    }

    const count = await this.table.countRows()
    return { chunkCount: count, fileCount: Math.ceil(count / 5) }
  }

  /**
   * 创建或重建索引
   */
  async createIndex(chunks: IndexedChunk[]): Promise<void> {
    if (!this.db) return

    if (chunks.length === 0) {
      console.log('[VectorStore] No chunks to index')
      return
    }

    // 准备数据
    const data = chunks.map(chunk => ({
      id: chunk.id,
      filePath: chunk.filePath,
      relativePath: chunk.relativePath,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      type: chunk.type,
      language: chunk.language,
      symbols: chunk.symbols?.join(',') || '',
      vector: chunk.vector,
    }))

    const tables = await this.db.tableNames()
    if (tables.includes(this.tableName)) {
      await this.db.dropTable(this.tableName)
    }

    this.table = await this.db.createTable(this.tableName, data)
    console.log(`[VectorStore] Created index with ${chunks.length} chunks`)
  }

  /**
   * 添加或更新文件的 chunks
   */
  async upsertFile(filePath: string, chunks: IndexedChunk[]): Promise<void> {
    if (!this.table || !this.db) return

    try {
      await this.table.delete(`filePath = '${filePath.replace(/'/g, "''")}'`)
    } catch {
      // ignore
    }

    if (chunks.length === 0) return

    const data = chunks.map(chunk => ({
      id: chunk.id,
      filePath: chunk.filePath,
      relativePath: chunk.relativePath,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      type: chunk.type,
      language: chunk.language,
      symbols: chunk.symbols?.join(',') || '',
      vector: chunk.vector,
    }))

    await this.table.add(data)
  }

  /**
   * 删除文件的 chunks
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.table) return

    try {
      await this.table.delete(`filePath = '${filePath.replace(/'/g, "''")}'`)
    } catch {
      // ignore
    }
  }

  /**
   * 向量搜索
   */
  async search(queryVector: number[], topK: number = 10): Promise<SearchResult[]> {
    if (!this.table) return []

    const results = await this.table
      .search(queryVector)
      .limit(topK)
      .execute()

    return results.map((r: LanceDBSearchResult) => ({
      filePath: r.filePath,
      relativePath: r.relativePath,
      content: r.content,
      startLine: r.startLine,
      endLine: r.endLine,
      type: r.type,
      language: r.language,
      score: 1 - r._distance,
    }))
  }

  /**
   * 清空索引
   */
  async clear(): Promise<void> {
    if (!this.db) return

    const tables = await this.db.tableNames()
    if (tables.includes(this.tableName)) {
      await this.db.dropTable(this.tableName)
      this.table = null
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.db = null
    this.table = null
  }
}
