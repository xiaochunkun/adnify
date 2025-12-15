// Authentication types - prepared for future login functionality

export interface User {
	id: string
	email: string
	name: string
	avatar?: string
	plan: 'free' | 'pro' | 'enterprise'
	createdAt: string
}

export interface AuthState {
	user: User | null
	isAuthenticated: boolean
	isLoading: boolean
	error: string | null
}

export interface LoginCredentials {
	email: string
	password: string
}

export interface RegisterCredentials {
	email: string
	password: string
	name: string
}

export interface AuthTokens {
	accessToken: string
	refreshToken: string
	expiresAt: number
}

export interface AuthService {
	login(credentials: LoginCredentials): Promise<User>
	register(credentials: RegisterCredentials): Promise<User>
	logout(): Promise<void>
	refreshToken(): Promise<AuthTokens>
	getCurrentUser(): Promise<User | null>
	updateProfile(data: Partial<User>): Promise<User>
}
