/**
 * CircuitExp1 AI LLM Plugin API Specification
 * This file defines the complete API for developing AI LLM plugins
 */

// Core plugin interfaces
export interface Plugin {
  metadata: PluginMetadata;
  activate(api: PluginAPI): Promise<void>;
  deactivate(): Promise<void>;
  onConfigChange?(config: PluginConfig): void;
  onThemeChange?(theme: string): void;
  onLayoutChange?(layout: LayoutConfig): void;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  license: string;
  keywords?: string[];
  category: PluginCategory;
  engines: {
    circuitexp1: string;
    node?: string;
  };
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  main: string;
  types?: string;
  ai?: {
    platforms: AIPlatform[];
    capabilities: AICapability[];
  };
}

export type PluginCategory = 
  | 'ai-integration'
  | 'chat-assistant'
  | 'code-generation'
  | 'analysis'
  | 'automation'
  | 'ui-enhancement'
  | 'data-processing'
  | 'integration';

export type AIPlatform = 
  | 'openai'
  | 'anthropic'
  | 'google-gemini'
  | 'meta-llama'
  | 'azure-openai'
  | 'huggingface'
  | 'local-ollama'
  | 'custom';

export type AICapability =
  | 'chat-completion'
  | 'code-completion'
  | 'image-generation'
  | 'text-analysis'
  | 'summarization'
  | 'translation'
  | 'sentiment-analysis'
  | 'entity-extraction';

// Plugin configuration
export interface PluginConfig {
  enabled: boolean;
  debug: boolean;
  apiKeys: Record<string, string>;
  settings: Record<string, any>;
  limits: {
    maxTokens: number;
    maxRequests: number;
    timeout: number;
  };
}

// Main Plugin API
export interface PluginAPI {
  // Core system access
  version: string;
  config: ConfigManager;
  events: EventManager;
  logger: Logger;
  storage: StorageManager;
  
  // UI integration
  ui: UIManager;
  
  // AI services
  ai: AIServices;
  
  // File operations (sandboxed)
  files: FileManager;
  
  // Network operations (controlled)
  network: NetworkManager;
  
  // Plugin management
  plugins: PluginManager;
}

// Configuration management
export interface ConfigManager {
  get<T = any>(key: string, defaultValue?: T): T;
  set<T = any>(key: string, value: T): Promise<void>;
  has(key: string): boolean;
  delete(key: string): Promise<void>;
  watch(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
  getAll(): Record<string, any>;
}

// Event system
export interface EventManager {
  on(event: PluginEvent, listener: EventListener): () => void;
  off(event: PluginEvent, listener: EventListener): void;
  emit(event: PluginEvent, ...args: any[]): Promise<void>;
  once(event: PluginEvent, listener: EventListener): () => void;
}

export type PluginEvent = 
  | 'plugin:activated'
  | 'plugin:deactivated'
  | 'config:changed'
  | 'theme:changed'
  | 'file:opened'
  | 'file:closed'
  | 'file:changed'
  | 'selection:changed'
  | 'ai:request:start'
  | 'ai:request:complete'
  | 'ai:request:error'
  | 'ui:panel:opened'
  | 'ui:panel:closed';

export type EventListener = (...args: any[]) => void | Promise<void>;

// Logging
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error | any): void;
  trace(message: string, meta?: any): void;
}

// Storage management
export interface StorageManager {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  createScope(scope: string): ScopedStorage;
}

export interface ScopedStorage {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

// UI management
export interface UIManager {
  registerComponent(type: string, component: React.ComponentType<any>): void;
  unregisterComponent(type: string, componentId: string): void;
  
  registerPanel(panel: PanelConfig): void;
  unregisterPanel(panelId: string): void;
  
  registerMenuItem(item: MenuItemConfig): void;
  unregisterMenuItem(itemId: string): void;
  
  showNotification(notification: NotificationConfig): void;
  showModal(modal: ModalConfig): Promise<any>;
  
  getTheme(): string;
  onThemeChange(callback: (theme: string) => void): () => void;
}

export interface PanelConfig {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  icon?: string;
  position?: 'left' | 'right' | 'bottom' | 'center';
  size?: { width?: number; height?: number };
  resizable?: boolean;
  closable?: boolean;
}

export interface MenuItemConfig {
  id: string;
  label: string;
  action: () => void;
  icon?: string;
  submenu?: MenuItemConfig[];
  accelerator?: string;
  when?: () => boolean;
}

export interface NotificationConfig {
  id?: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
}

export interface ModalConfig {
  id?: string;
  title: string;
  component: React.ComponentType<any>;
  size?: 'small' | 'medium' | 'large';
  closable?: boolean;
  backdrop?: boolean;
}

// AI services
export interface AIServices {
  openai: OpenAIService;
  anthropic: AnthropicService;
  gemini: GeminiService;
  llama: LlamaService;
  azure: AzureService;
  custom: CustomAIService;
}

// OpenAI service
export interface OpenAIService {
  chat: {
    createCompletion(params: OpenAIChatParams): Promise<OpenAIChatResponse>;
    createStream(params: OpenAIChatParams): Promise<ReadableStream<OpenAIChatStreamChunk>>;
  };
  
  embeddings: {
    create(params: OpenAIEmbeddingParams): Promise<OpenAIEmbeddingResponse>;
  };
  
  images: {
    generate(params: OpenAIImageParams): Promise<OpenAIImageResponse>;
    edit(params: OpenAIImageEditParams): Promise<OpenAIImageResponse>;
  };
  
  audio: {
    transcribe(params: OpenAITranscriptionParams): Promise<OpenAITranscriptionResponse>;
    translate(params: OpenAITranslationParams): Promise<OpenAITranslationResponse>;
  };
}

export interface OpenAIChatParams {
  model: OpenAIModel;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  response_format?: { type: 'text' | 'json_object' };
}

export type OpenAIModel = 
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-16k';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChatStreamChunk {
  id: string;
  choices: {
    delta: Partial<OpenAIMessage>;
    finish_reason?: string;
  }[];
}

// Anthropic service
export interface AnthropicService {
  chat: {
    createMessage(params: AnthropicMessageParams): Promise<AnthropicMessageResponse>;
    createStream(params: AnthropicMessageParams): Promise<ReadableStream<AnthropicMessageStreamChunk>>;
  };
}

export interface AnthropicMessageParams {
  model: AnthropicModel;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  system?: string;
  stream?: boolean;
}

export type AnthropicModel = 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Google Gemini service
export interface GeminiService {
  chat: {
    generateContent(params: GeminiContentParams): Promise<GeminiResponse>;
    generateContentStream(params: GeminiContentParams): Promise<ReadableStream<GeminiResponse>>;
  };
}

export interface GeminiContentParams {
  model: GeminiModel;
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

export type GeminiModel = 'gemini-pro' | 'gemini-pro-vision';

export interface GeminiContent {
  role?: string;
  parts: Array<{ text: string }>;
}

// File management (sandboxed)
export interface FileManager {
  read(path: string, encoding?: BufferEncoding): Promise<string>;
  write(path: string, data: string, encoding?: BufferEncoding): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
  stat(path: string): Promise<FileStats>;
  
  // Restricted to plugin directory
  getPluginDir(): string;
  getTempDir(): string;
}

export interface FileStats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  ctime: Date;
}

// Network management
export interface NetworkManager {
  fetch(url: string, options?: RequestInit): Promise<Response>;
  get(url: string, options?: RequestInit): Promise<Response>;
  post(url: string, data?: any, options?: RequestInit): Promise<Response>;
  put(url: string, data?: any, options?: RequestInit): Promise<Response>;
  delete(url: string, options?: RequestInit): Promise<Response>;
  
  // Rate limiting and caching
  setRateLimit(domain: string, requests: number, period: number): void;
  clearCache(): void;
  
  // WebSocket support
  createWebSocket(url: string): WebSocket;
}

// Plugin management
export interface PluginManager {
  getPlugin(id: string): Plugin | null;
  listPlugins(): Plugin[];
  enablePlugin(id: string): Promise<void>;
  disablePlugin(id: string): Promise<void>;
  isPluginEnabled(id: string): boolean;
  
  // Plugin communication
  callPlugin(id: string, method: string, ...args: any[]): Promise<any>;
  onPluginEvent(pluginId: string, event: string, callback: EventListener): () => void;
}

// Custom AI service for local models
export interface CustomAIService {
  registerProvider(name: string, provider: AIProvider): void;
  unregisterProvider(name: string): void;
  
  chat: {
    createCompletion(params: CustomAIParams): Promise<CustomAIResponse>;
  };
}

export interface AIProvider {
  name: string;
  createCompletion(params: CustomAIParams): Promise<CustomAIResponse>;
  validateConfig(config: any): boolean;
}

export interface CustomAIParams {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  [key: string]: any;
}

export interface CustomAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Layout configuration
export interface LayoutConfig {
  panels: PanelConfig[];
  sidebar: {
    width: number;
    collapsed: boolean;
  };
  theme: string;
  fontSize: number;
}