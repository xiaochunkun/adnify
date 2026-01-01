/**
 * MCP 服务器预设配置
 * 内置常用的 MCP 服务器，用户可以一键添加
 */

export interface McpPreset {
  /** 预设 ID */
  id: string
  /** 显示名称 */
  name: string
  /** 描述 */
  description: string
  /** 描述（中文） */
  descriptionZh: string
  /** 分类 */
  category: McpPresetCategory
  /** 图标（lucide 图标名） */
  icon: string
  /** 启动命令 */
  command: string
  /** 命令参数 */
  args?: string[]
  /** 环境变量配置 */
  envConfig?: McpEnvConfig[]
  /** 默认自动批准的工具 */
  defaultAutoApprove?: string[]
  /** 是否需要额外配置 */
  requiresConfig: boolean
  /** 官方文档链接 */
  docsUrl?: string
  /** 是否为官方 MCP 服务器 */
  official?: boolean
  /** 标签 */
  tags?: string[]
  /** 安装前置命令（首次使用时需要执行） */
  setupCommand?: string
  /** 安装说明 */
  setupNote?: string
  /** 安装说明（中文） */
  setupNoteZh?: string
}

export interface McpEnvConfig {
  /** 环境变量名 */
  key: string
  /** 显示名称 */
  label: string
  /** 显示名称（中文） */
  labelZh: string
  /** 描述 */
  description?: string
  /** 描述（中文） */
  descriptionZh?: string
  /** 是否必填 */
  required: boolean
  /** 是否为密钥（显示为密码输入框） */
  secret?: boolean
  /** 默认值 */
  defaultValue?: string
  /** 占位符 */
  placeholder?: string
}

export type McpPresetCategory = 
  | 'search'      // 搜索
  | 'database'    // 数据库
  | 'filesystem'  // 文件系统
  | 'development' // 开发工具
  | 'productivity'// 生产力
  | 'ai'          // AI 服务
  | 'cloud'       // 云服务
  | 'other'       // 其他

/** 分类显示名称 */
export const MCP_CATEGORY_NAMES: Record<McpPresetCategory, { en: string; zh: string }> = {
  search: { en: 'Search', zh: '搜索' },
  database: { en: 'Database', zh: '数据库' },
  filesystem: { en: 'File System', zh: '文件系统' },
  development: { en: 'Development', zh: '开发工具' },
  productivity: { en: 'Productivity', zh: '生产力' },
  ai: { en: 'AI Services', zh: 'AI 服务' },
  cloud: { en: 'Cloud', zh: '云服务' },
  other: { en: 'Other', zh: '其他' },
}

/** 内置 MCP 服务器预设 */
export const MCP_PRESETS: McpPreset[] = [
  // ===== 搜索类 =====
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search using Brave Search API',
    descriptionZh: '使用 Brave Search API 进行网络搜索',
    category: 'search',
    icon: 'Search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    envConfig: [
      {
        key: 'BRAVE_API_KEY',
        label: 'Brave API Key',
        labelZh: 'Brave API 密钥',
        description: 'Get your API key from https://brave.com/search/api/',
        descriptionZh: '从 https://brave.com/search/api/ 获取 API 密钥',
        required: true,
        secret: true,
        placeholder: 'BSA...',
      },
    ],
    defaultAutoApprove: ['brave_web_search', 'brave_local_search'],
    requiresConfig: true,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    official: true,
    tags: ['search', 'web'],
  },
  {
    id: 'tavily-search',
    name: 'Tavily Search',
    description: 'AI-powered search engine for LLMs',
    descriptionZh: '为 LLM 优化的 AI 搜索引擎',
    category: 'search',
    icon: 'Sparkles',
    command: 'npx',
    args: ['-y', 'tavily-mcp@latest'],
    envConfig: [
      {
        key: 'TAVILY_API_KEY',
        label: 'Tavily API Key',
        labelZh: 'Tavily API 密钥',
        description: 'Get your API key from https://tavily.com/',
        descriptionZh: '从 https://tavily.com/ 获取 API 密钥',
        required: true,
        secret: true,
        placeholder: 'tvly-...',
      },
    ],
    defaultAutoApprove: ['tavily_search'],
    requiresConfig: true,
    docsUrl: 'https://github.com/tavily-ai/tavily-mcp',
    tags: ['search', 'ai'],
  },

  // ===== 文件系统类 =====
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Secure file operations with configurable access',
    descriptionZh: '安全的文件操作，可配置访问权限',
    category: 'filesystem',
    icon: 'FolderOpen',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${ALLOWED_PATH}'],
    envConfig: [
      {
        key: 'ALLOWED_PATH',
        label: 'Allowed Directory',
        labelZh: '允许访问的目录',
        description: 'Directory path that the server can access',
        descriptionZh: '服务器可以访问的目录路径',
        required: true,
        secret: false,
        placeholder: '/path/to/directory',
      },
    ],
    defaultAutoApprove: ['read_file', 'read_multiple_files', 'list_directory', 'directory_tree', 'search_files', 'get_file_info'],
    requiresConfig: true,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    official: true,
    tags: ['files', 'local'],
  },

  // ===== 数据库类 =====
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Query and manage SQLite databases',
    descriptionZh: '查询和管理 SQLite 数据库',
    category: 'database',
    icon: 'Database',
    command: 'uvx',
    args: ['mcp-server-sqlite', '--db-path', '${DB_PATH}'],
    envConfig: [
      {
        key: 'DB_PATH',
        label: 'Database Path',
        labelZh: '数据库路径',
        description: 'Path to SQLite database file',
        descriptionZh: 'SQLite 数据库文件路径',
        required: true,
        secret: false,
        placeholder: '/path/to/database.db',
      },
    ],
    defaultAutoApprove: ['read_query', 'list_tables', 'describe_table'],
    requiresConfig: true,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    official: true,
    tags: ['database', 'sql'],
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Connect to PostgreSQL databases',
    descriptionZh: '连接 PostgreSQL 数据库',
    category: 'database',
    icon: 'Database',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envConfig: [
      {
        key: 'POSTGRES_CONNECTION_STRING',
        label: 'Connection String',
        labelZh: '连接字符串',
        description: 'PostgreSQL connection string',
        descriptionZh: 'PostgreSQL 连接字符串',
        required: true,
        secret: true,
        placeholder: 'postgresql://user:password@localhost:5432/dbname',
      },
    ],
    defaultAutoApprove: ['query'],
    requiresConfig: true,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    official: true,
    tags: ['database', 'sql'],
  },

  // ===== 开发工具类 =====
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repositories, issues, and PRs',
    descriptionZh: '与 GitHub 仓库、Issues 和 PR 交互',
    category: 'development',
    icon: 'Github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envConfig: [
      {
        key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        label: 'GitHub Token',
        labelZh: 'GitHub 令牌',
        description: 'Personal access token with repo permissions',
        descriptionZh: '具有 repo 权限的个人访问令牌',
        required: true,
        secret: true,
        placeholder: 'ghp_...',
      },
    ],
    defaultAutoApprove: ['search_repositories', 'get_file_contents', 'list_commits'],
    requiresConfig: true,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    official: true,
    tags: ['git', 'code'],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Interact with GitLab repositories and CI/CD',
    descriptionZh: '与 GitLab 仓库和 CI/CD 交互',
    category: 'development',
    icon: 'GitBranch',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-gitlab'],
    envConfig: [
      {
        key: 'GITLAB_PERSONAL_ACCESS_TOKEN',
        label: 'GitLab Token',
        labelZh: 'GitLab 令牌',
        description: 'Personal access token',
        descriptionZh: '个人访问令牌',
        required: true,
        secret: true,
        placeholder: 'glpat-...',
      },
      {
        key: 'GITLAB_API_URL',
        label: 'GitLab API URL',
        labelZh: 'GitLab API 地址',
        description: 'GitLab API URL (default: https://gitlab.com/api/v4)',
        descriptionZh: 'GitLab API 地址（默认：https://gitlab.com/api/v4）',
        required: false,
        secret: false,
        defaultValue: 'https://gitlab.com/api/v4',
      },
    ],
    defaultAutoApprove: ['search_repositories', 'get_file_contents'],
    requiresConfig: true,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
    official: true,
    tags: ['git', 'code'],
  },

  // ===== 生产力类 =====
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent memory using knowledge graph',
    descriptionZh: '使用知识图谱的持久化记忆',
    category: 'productivity',
    icon: 'Brain',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    envConfig: [],
    defaultAutoApprove: ['create_entities', 'create_relations', 'read_graph', 'search_nodes'],
    requiresConfig: false,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    official: true,
    tags: ['memory', 'knowledge'],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Dynamic problem-solving through thought sequences',
    descriptionZh: '通过思维序列进行动态问题解决',
    category: 'productivity',
    icon: 'ListOrdered',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    envConfig: [],
    defaultAutoApprove: ['sequentialthinking'],
    requiresConfig: false,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    official: true,
    tags: ['thinking', 'reasoning'],
  },

  // ===== 云服务类 =====
  {
    id: 'aws-docs',
    name: 'AWS Documentation',
    description: 'Search and read AWS documentation',
    descriptionZh: '搜索和阅读 AWS 文档',
    category: 'cloud',
    icon: 'Cloud',
    command: 'uvx',
    args: ['awslabs.aws-documentation-mcp-server@latest'],
    envConfig: [
      {
        key: 'FASTMCP_LOG_LEVEL',
        label: 'Log Level',
        labelZh: '日志级别',
        required: false,
        secret: false,
        defaultValue: 'ERROR',
      },
    ],
    defaultAutoApprove: ['search_documentation', 'read_documentation'],
    requiresConfig: false,
    docsUrl: 'https://github.com/awslabs/mcp',
    tags: ['aws', 'docs'],
  },

  // ===== AI 服务类 =====
  {
    id: 'fetch',
    name: 'Fetch',
    description: 'Fetch and convert web content to markdown',
    descriptionZh: '获取网页内容并转换为 Markdown',
    category: 'ai',
    icon: 'Globe',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    envConfig: [],
    defaultAutoApprove: ['fetch'],
    requiresConfig: false,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    official: true,
    tags: ['web', 'scraping'],
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation and web scraping',
    descriptionZh: '浏览器自动化和网页抓取',
    category: 'ai',
    icon: 'Monitor',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    envConfig: [
      {
        key: 'PUPPETEER_EXECUTABLE_PATH',
        label: 'Chrome Path (Optional)',
        labelZh: 'Chrome 路径（可选）',
        description: 'Path to Chrome executable. If not set, will use bundled Chromium.',
        descriptionZh: 'Chrome 可执行文件路径。如不设置，将使用内置 Chromium。',
        required: false,
        secret: false,
        placeholder: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      },
    ],
    defaultAutoApprove: ['puppeteer_navigate', 'puppeteer_screenshot', 'puppeteer_evaluate'],
    requiresConfig: false,
    setupCommand: 'npx puppeteer browsers install chrome',
    setupNote: 'Requires Chrome browser. Run setup command to download Chromium, or set PUPPETEER_EXECUTABLE_PATH to use system Chrome.',
    setupNoteZh: '需要 Chrome 浏览器。运行安装命令下载 Chromium，或设置 PUPPETEER_EXECUTABLE_PATH 使用系统 Chrome。',
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    official: true,
    tags: ['browser', 'automation'],
  },

  // ===== 其他 =====
  {
    id: 'time',
    name: 'Time',
    description: 'Get current time and timezone information',
    descriptionZh: '获取当前时间和时区信息',
    category: 'other',
    icon: 'Clock',
    command: 'uvx',
    args: ['mcp-server-time'],
    envConfig: [],
    defaultAutoApprove: ['get_current_time'],
    requiresConfig: false,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    official: true,
    tags: ['time', 'utility'],
  },
  {
    id: 'everything',
    name: 'Everything',
    description: 'Reference server with all MCP features for testing',
    descriptionZh: '包含所有 MCP 功能的参考服务器，用于测试',
    category: 'other',
    icon: 'Boxes',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-everything'],
    envConfig: [],
    defaultAutoApprove: [],
    requiresConfig: false,
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
    official: true,
    tags: ['testing', 'demo'],
  },
]

/** 根据分类获取预设 */
export function getPresetsByCategory(category: McpPresetCategory): McpPreset[] {
  return MCP_PRESETS.filter(p => p.category === category)
}

/** 根据 ID 获取预设 */
export function getPresetById(id: string): McpPreset | undefined {
  return MCP_PRESETS.find(p => p.id === id)
}

/** 获取所有分类 */
export function getAllCategories(): McpPresetCategory[] {
  const categories = new Set(MCP_PRESETS.map(p => p.category))
  return Array.from(categories)
}

/** 搜索预设 */
export function searchPresets(query: string): McpPreset[] {
  const lowerQuery = query.toLowerCase()
  return MCP_PRESETS.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description.toLowerCase().includes(lowerQuery) ||
    p.descriptionZh.includes(query) ||
    p.tags?.some(t => t.toLowerCase().includes(lowerQuery))
  )
}
