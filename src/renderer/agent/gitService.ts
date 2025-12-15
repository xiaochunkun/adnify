/**
 * Git 服务
 * 提供基本的 Git 操作支持
 */

export interface GitStatus {
	branch: string
	ahead: number
	behind: number
	staged: GitFileChange[]
	unstaged: GitFileChange[]
	untracked: string[]
}

export interface GitFileChange {
	path: string
	status: 'added' | 'modified' | 'deleted' | 'renamed'
	oldPath?: string
}

export interface GitCommit {
	hash: string
	shortHash: string
	message: string
	author: string
	date: Date
}

class GitService {
	private workspacePath: string | null = null

	setWorkspace(path: string | null) {
		this.workspacePath = path
	}

	/**
	 * 检查是否是 Git 仓库
	 */
	async isGitRepo(): Promise<boolean> {
		if (!this.workspacePath) return false
		try {
			const result = await window.electronAPI.executeCommand(
				'git rev-parse --is-inside-work-tree',
				this.workspacePath
			)
			return result.exitCode === 0
		} catch {
			return false
		}
	}

	/**
	 * 获取当前分支
	 */
	async getCurrentBranch(): Promise<string | null> {
		if (!this.workspacePath) return null
		try {
			const result = await window.electronAPI.executeCommand(
				'git branch --show-current',
				this.workspacePath
			)
			return result.exitCode === 0 ? result.output.trim() : null
		} catch {
			return null
		}
	}

	/**
	 * 获取 Git 状态
	 */
	async getStatus(): Promise<GitStatus | null> {
		if (!this.workspacePath) return null

		try {
			// 获取分支信息
			const branchResult = await window.electronAPI.executeCommand(
				'git branch --show-current',
				this.workspacePath
			)
			const branch = branchResult.output.trim() || 'HEAD'

			// 获取 ahead/behind
			let ahead = 0, behind = 0
			try {
				const aheadBehind = await window.electronAPI.executeCommand(
					'git rev-list --left-right --count @{upstream}...HEAD',
					this.workspacePath
				)
				if (aheadBehind.exitCode === 0) {
					const [b, a] = aheadBehind.output.trim().split(/\s+/).map(Number)
					ahead = a || 0
					behind = b || 0
				}
			} catch {
				// 没有上游分支
			}

			// 获取状态
			const statusResult = await window.electronAPI.executeCommand(
				'git status --porcelain=v1',
				this.workspacePath
			)

			const staged: GitFileChange[] = []
			const unstaged: GitFileChange[] = []
			const untracked: string[] = []

			if (statusResult.exitCode === 0 && statusResult.output) {
				const lines = statusResult.output.trim().split('\n').filter(Boolean)

				for (const line of lines) {
					const indexStatus = line[0]
					const workTreeStatus = line[1]
					const filePath = line.slice(3).trim()

					// 未跟踪文件
					if (indexStatus === '?' && workTreeStatus === '?') {
						untracked.push(filePath)
						continue
					}

					// 暂存区变更
					if (indexStatus !== ' ' && indexStatus !== '?') {
						staged.push({
							path: filePath,
							status: this.parseStatus(indexStatus),
						})
					}

					// 工作区变更
					if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
						unstaged.push({
							path: filePath,
							status: this.parseStatus(workTreeStatus),
						})
					}
				}
			}

			return { branch, ahead, behind, staged, unstaged, untracked }
		} catch {
			return null
		}
	}

	private parseStatus(char: string): GitFileChange['status'] {
		switch (char) {
			case 'A': return 'added'
			case 'M': return 'modified'
			case 'D': return 'deleted'
			case 'R': return 'renamed'
			default: return 'modified'
		}
	}

	/**
	 * 获取文件 diff
	 */
	async getFileDiff(filePath: string, staged: boolean = false): Promise<string | null> {
		if (!this.workspacePath) return null
		try {
			const cmd = staged
				? `git diff --cached -- "${filePath}"`
				: `git diff -- "${filePath}"`
			const result = await window.electronAPI.executeCommand(cmd, this.workspacePath)
			return result.exitCode === 0 ? result.output : null
		} catch {
			return null
		}
	}

	/**
	 * 暂存文件
	 */
	async stageFile(filePath: string): Promise<boolean> {
		if (!this.workspacePath) return false
		try {
			const result = await window.electronAPI.executeCommand(
				`git add "${filePath}"`,
				this.workspacePath
			)
			return result.exitCode === 0
		} catch {
			return false
		}
	}

	/**
	 * 取消暂存文件
	 */
	async unstageFile(filePath: string): Promise<boolean> {
		if (!this.workspacePath) return false
		try {
			const result = await window.electronAPI.executeCommand(
				`git reset HEAD -- "${filePath}"`,
				this.workspacePath
			)
			return result.exitCode === 0
		} catch {
			return false
		}
	}

	/**
	 * 放弃文件更改
	 */
	async discardChanges(filePath: string): Promise<boolean> {
		if (!this.workspacePath) return false
		try {
			const result = await window.electronAPI.executeCommand(
				`git checkout -- "${filePath}"`,
				this.workspacePath
			)
			return result.exitCode === 0
		} catch {
			return false
		}
	}

	/**
	 * 获取最近提交
	 */
	async getRecentCommits(count: number = 10): Promise<GitCommit[]> {
		if (!this.workspacePath) return []
		try {
			const result = await window.electronAPI.executeCommand(
				`git log -${count} --pretty=format:"%H|%h|%s|%an|%aI"`,
				this.workspacePath
			)

			if (result.exitCode !== 0 || !result.output) return []

			return result.output.trim().split('\n').filter(Boolean).map(line => {
				const [hash, shortHash, message, author, dateStr] = line.split('|')
				return {
					hash,
					shortHash,
					message,
					author,
					date: new Date(dateStr),
				}
			})
		} catch {
			return []
		}
	}

	/**
	 * 提交
	 */
	async commit(message: string): Promise<{ success: boolean; error?: string }> {
		if (!this.workspacePath) return { success: false, error: 'No workspace' }
		try {
			const result = await window.electronAPI.executeCommand(
				`git commit -m "${message.replace(/"/g, '\\"')}"`,
				this.workspacePath
			)
			return {
				success: result.exitCode === 0,
				error: result.exitCode !== 0 ? result.errorOutput || result.output : undefined,
			}
		} catch (e: any) {
			return { success: false, error: e.message }
		}
	}
}

export const gitService = new GitService()
