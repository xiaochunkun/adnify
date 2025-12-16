/**
 * Embedding 服务
 * 支持多个免费/付费 Embedding API 提供商
 */

import {
  EmbeddingConfig,
  EmbeddingProvider,
  DEFAULT_EMBEDDING_MODELS,
  EMBEDDING_ENDPOINTS,
} from './types'

export class EmbeddingService {
  private config: EmbeddingConfig

  constructor(config: EmbeddingConfig) {
    this.config = {
      ...config,
      model: config.model || DEFAULT_EMBEDDING_MODELS[config.provider],
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.provider && !config.model) {
      this.config.model = DEFAULT_EMBEDDING_MODELS[config.provider]
    }
  }

  /**
   * 获取单个文本的 embedding
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text])
    return results[0]
  }

  /**
   * 批量获取 embedding
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    switch (this.config.provider) {
      case 'jina':
        return this.embedJina(texts)
      case 'voyage':
        return this.embedVoyage(texts)
      case 'openai':
        return this.embedOpenAI(texts)
      case 'cohere':
        return this.embedCohere(texts)
      case 'huggingface':
        return this.embedHuggingFace(texts)
      case 'ollama':
        return this.embedOllama(texts)
      default:
        throw new Error(`Unsupported embedding provider: ${this.config.provider}`)
    }
  }

  /**
   * Jina AI Embedding (免费 100万 tokens/月)
   * https://jina.ai/embeddings/
   */
  private async embedJina(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl || EMBEDDING_ENDPOINTS.jina
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'jina-embeddings-v2-base-code',
        input: texts,
      }),
    })

    const data = await response.json() as { data: { embedding: number[] }[] }
    return data.data.map((item: { embedding: number[] }) => item.embedding)
  }

  /**
   * Voyage AI Embedding (免费 5000万 tokens)
   * https://www.voyageai.com/
   */
  private async embedVoyage(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl || EMBEDDING_ENDPOINTS.voyage

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'voyage-code-2',
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Voyage API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as { data: { embedding: number[] }[] }
    return data.data.map((item: { embedding: number[] }) => item.embedding)
  }

  /**
   * OpenAI Embedding
   */
  private async embedOpenAI(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl || EMBEDDING_ENDPOINTS.openai

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'text-embedding-3-small',
        input: texts,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as { data: { embedding: number[]; index: number }[] }
    return data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((item: { embedding: number[] }) => item.embedding)
  }

  /**
   * Cohere Embedding (免费 100次/分钟)
   */
  private async embedCohere(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl || EMBEDDING_ENDPOINTS.cohere

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'embed-english-v3.0',
        texts: texts,
        input_type: 'search_document',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Cohere API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as { embeddings: number[][] }
    return data.embeddings
  }

  /**
   * HuggingFace Inference API (免费，有速率限制)
   */
  private async embedHuggingFace(texts: string[]): Promise<number[][]> {
    const model = this.config.model || 'sentence-transformers/all-MiniLM-L6-v2'
    const url = this.config.baseUrl || `${EMBEDDING_ENDPOINTS.huggingface}/${model}`

    // HuggingFace 需要逐个请求或使用特定格式
    const results: number[][] = []
    
    for (const text of texts) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`)
      }

      const data = await response.json() as number[] | number[][]
      // HuggingFace 返回的是 token embeddings，需要平均池化
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const pooled = this.meanPooling(data as number[][])
        results.push(pooled)
      } else {
        results.push(data as number[])
      }
    }

    return results
  }

  /**
   * Ollama 本地 Embedding (完全免费，需要本地运行 Ollama)
   */
  private async embedOllama(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl || EMBEDDING_ENDPOINTS.ollama
    const results: number[][] = []

    // Ollama 需要逐个请求
    for (const text of texts) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model || 'nomic-embed-text',
          prompt: text,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${response.status} - ${error}`)
      }

      const data = await response.json() as { embedding: number[] }
      results.push(data.embedding)
    }

    return results
  }

  /**
   * 平均池化（用于 HuggingFace token embeddings）
   */
  private meanPooling(tokenEmbeddings: number[][]): number[] {
    if (tokenEmbeddings.length === 0) return []
    
    const dim = tokenEmbeddings[0].length
    const result = new Array(dim).fill(0)
    
    for (const embedding of tokenEmbeddings) {
      for (let i = 0; i < dim; i++) {
        result[i] += embedding[i]
      }
    }
    
    for (let i = 0; i < dim; i++) {
      result[i] /= tokenEmbeddings.length
    }
    
    return result
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    const start = Date.now()
    
    try {
      await this.embed('test connection')
      return {
        success: true,
        latency: Date.now() - start,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
