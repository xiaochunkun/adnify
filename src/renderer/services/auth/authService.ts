// Auth service - placeholder for future implementation
import type { AuthService, User, LoginCredentials, RegisterCredentials, AuthTokens } from './types'

const AUTH_STORAGE_KEY = 'adnify_auth'

class AuthServiceImpl implements AuthService {
	private baseUrl: string = ''  // Will be configured when backend is ready

	setBaseUrl(url: string) {
		this.baseUrl = url
	}

	async login(credentials: LoginCredentials): Promise<User> {
		// TODO: Implement actual login when backend is ready
		// const response = await fetch(`${this.baseUrl}/auth/login`, {
		//   method: 'POST',
		//   headers: { 'Content-Type': 'application/json' },
		//   body: JSON.stringify(credentials),
		// })
		// const data = await response.json()
		// this.saveTokens(data.tokens)
		// return data.user

		throw new Error('Authentication not yet implemented')
	}

	async register(credentials: RegisterCredentials): Promise<User> {
		// TODO: Implement actual registration
		throw new Error('Registration not yet implemented')
	}

	async logout(): Promise<void> {
		localStorage.removeItem(AUTH_STORAGE_KEY)
		// TODO: Call backend logout endpoint
	}

	async refreshToken(): Promise<AuthTokens> {
		// TODO: Implement token refresh
		throw new Error('Token refresh not yet implemented')
	}

	async getCurrentUser(): Promise<User | null> {
		const stored = localStorage.getItem(AUTH_STORAGE_KEY)
		if (!stored) return null

		try {
			const { user, tokens } = JSON.parse(stored)
			if (tokens.expiresAt < Date.now()) {
				await this.refreshToken()
			}
			return user
		} catch {
			return null
		}
	}

	async updateProfile(data: Partial<User>): Promise<User> {
		// TODO: Implement profile update
		throw new Error('Profile update not yet implemented')
	}

	private saveTokens(tokens: AuthTokens, user: User) {
		localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ tokens, user }))
	}
}

export const authService = new AuthServiceImpl()
