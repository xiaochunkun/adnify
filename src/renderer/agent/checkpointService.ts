/**
 * 检查点服务 - 支持文件状态回滚
 * 参考 void 编辑器的检查点系统
 */

import { Checkpoint, FileSnapshot } from './toolTypes'

const MAX_CHECKPOINTS = 50
const MAX_SNAPSHOTS_PER_CHECKPOINT = 20

class CheckpointService {
	private checkpoints: Checkpoint[] = []
	private currentIdx: number = -1

	/**
	 * 创建检查点前获取文件快照
	 */
	async createSnapshot(filePath: string): Promise<FileSnapshot | null> {
		try {
			const content = await window.electronAPI.readFile(filePath)
			if (content === null) return null

			return {
				path: filePath,
				content,
				timestamp: Date.now(),
			}
		} catch {
			return null
		}
	}

	/**
	 * 创建新检查点
	 */
	async createCheckpoint(
		type: 'user_message' | 'tool_edit',
		description: string,
		filePaths: string[]
	): Promise<Checkpoint> {
		const snapshots: Record<string, FileSnapshot> = {}

		// 只保存前 N 个文件的快照
		const pathsToSnapshot = filePaths.slice(0, MAX_SNAPSHOTS_PER_CHECKPOINT)

		for (const path of pathsToSnapshot) {
			const snapshot = await this.createSnapshot(path)
			if (snapshot) {
				snapshots[path] = snapshot
			}
		}

		const checkpoint: Checkpoint = {
			id: crypto.randomUUID(),
			type,
			timestamp: Date.now(),
			snapshots,
			description,
		}

		// 如果当前不在最新位置，删除后面的检查点
		if (this.currentIdx < this.checkpoints.length - 1) {
			this.checkpoints = this.checkpoints.slice(0, this.currentIdx + 1)
		}

		this.checkpoints.push(checkpoint)
		this.currentIdx = this.checkpoints.length - 1

		// 限制检查点数量
		if (this.checkpoints.length > MAX_CHECKPOINTS) {
			this.checkpoints = this.checkpoints.slice(-MAX_CHECKPOINTS)
			this.currentIdx = this.checkpoints.length - 1
		}

		return checkpoint
	}

	/**
	 * 获取所有检查点
	 */
	getCheckpoints(): Checkpoint[] {
		return [...this.checkpoints]
	}

	/**
	 * 获取当前检查点索引
	 */
	getCurrentIndex(): number {
		return this.currentIdx
	}

	/**
	 * 回滚到指定检查点
	 */
	async rollbackTo(checkpointId: string): Promise<{
		success: boolean
		restoredFiles: string[]
		errors: string[]
	}> {
		const idx = this.checkpoints.findIndex(c => c.id === checkpointId)
		if (idx === -1) {
			return { success: false, restoredFiles: [], errors: ['Checkpoint not found'] }
		}

		const checkpoint = this.checkpoints[idx]
		const restoredFiles: string[] = []
		const errors: string[] = []

		for (const [path, snapshot] of Object.entries(checkpoint.snapshots)) {
			try {
				const success = await window.electronAPI.writeFile(path, snapshot.content)
				if (success) {
					restoredFiles.push(path)
				} else {
					errors.push(`Failed to restore: ${path}`)
				}
			} catch (e: any) {
				errors.push(`Error restoring ${path}: ${e.message}`)
			}
		}

		this.currentIdx = idx

		return {
			success: errors.length === 0,
			restoredFiles,
			errors,
		}
	}

	/**
	 * 回滚到上一个检查点
	 */
	async rollbackToPrevious(): Promise<{
		success: boolean
		checkpoint: Checkpoint | null
		restoredFiles: string[]
		errors: string[]
	}> {
		if (this.currentIdx <= 0) {
			return {
				success: false,
				checkpoint: null,
				restoredFiles: [],
				errors: ['No previous checkpoint available'],
			}
		}

		const prevCheckpoint = this.checkpoints[this.currentIdx - 1]
		const result = await this.rollbackTo(prevCheckpoint.id)

		return {
			...result,
			checkpoint: prevCheckpoint,
		}
	}

	/**
	 * 获取文件在指定检查点的内容
	 */
	getFileAtCheckpoint(checkpointId: string, filePath: string): string | null {
		const checkpoint = this.checkpoints.find(c => c.id === checkpointId)
		if (!checkpoint) return null

		return checkpoint.snapshots[filePath]?.content ?? null
	}

	/**
	 * 获取两个检查点之间的文件变化
	 */
	getChangesBetween(
		fromCheckpointId: string,
		toCheckpointId: string
	): { path: string; type: 'added' | 'modified' | 'deleted' }[] {
		const fromIdx = this.checkpoints.findIndex(c => c.id === fromCheckpointId)
		const toIdx = this.checkpoints.findIndex(c => c.id === toCheckpointId)

		if (fromIdx === -1 || toIdx === -1) return []

		const fromCheckpoint = this.checkpoints[fromIdx]
		const toCheckpoint = this.checkpoints[toIdx]

		const changes: { path: string; type: 'added' | 'modified' | 'deleted' }[] = []
		const allPaths = new Set([
			...Object.keys(fromCheckpoint.snapshots),
			...Object.keys(toCheckpoint.snapshots),
		])

		for (const path of allPaths) {
			const fromSnapshot = fromCheckpoint.snapshots[path]
			const toSnapshot = toCheckpoint.snapshots[path]

			if (!fromSnapshot && toSnapshot) {
				changes.push({ path, type: 'added' })
			} else if (fromSnapshot && !toSnapshot) {
				changes.push({ path, type: 'deleted' })
			} else if (fromSnapshot && toSnapshot && fromSnapshot.content !== toSnapshot.content) {
				changes.push({ path, type: 'modified' })
			}
		}

		return changes
	}

	/**
	 * 清除所有检查点
	 */
	clear(): void {
		this.checkpoints = []
		this.currentIdx = -1
	}

	/**
	 * 导出检查点（用于持久化）
	 */
	export(): string {
		return JSON.stringify({
			checkpoints: this.checkpoints,
			currentIdx: this.currentIdx,
		})
	}

	/**
	 * 导入检查点
	 */
	import(data: string): boolean {
		try {
			const parsed = JSON.parse(data)
			if (Array.isArray(parsed.checkpoints)) {
				this.checkpoints = parsed.checkpoints
				this.currentIdx = parsed.currentIdx ?? this.checkpoints.length - 1
				return true
			}
		} catch {
			// ignore
		}
		return false
	}
}

// 单例导出
export const checkpointService = new CheckpointService()
