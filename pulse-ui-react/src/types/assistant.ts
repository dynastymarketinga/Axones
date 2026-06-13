export type AssistantDot = {
  type: string
  id: number | string
  label: string
  href: string
}

export type AssistantChip = {
  label: string
  tool: string
  params?: Record<string, unknown>
}

export type AssistantToolUsed = {
  name: string
  ok: boolean
}

export type AssistantRateLimit = {
  limit: number
  used: number
  remaining: number
}

export type AssistantStatus = {
  enabled: boolean
  allowed: boolean
  allowed_roles?: string[]
  tools_count?: number
  rate_limit?: AssistantRateLimit
}

export type AssistantChatContext = {
  route?: string
  entity_type?: string
  entity_id?: number | string
  area?: string
}

export type AssistantChatRequest = {
  message: string
  tool?: string
  tool_params?: Record<string, unknown>
  force_analysis?: boolean
  context?: AssistantChatContext
}

export type AssistantChatResponse = {
  assistant_message: string
  dots: AssistantDot[]
  follow_up_chips: AssistantChip[]
  tools_used: AssistantToolUsed[]
  model_used: string
  duration_ms: number
  rate_limit: AssistantRateLimit
}

export type AssistantSuggestionsResponse = {
  ok: boolean
  summary?: string
  data?: { chips: AssistantChip[] }
  follow_up_chips?: AssistantChip[]
  error?: string
}

export type AssistantMessageItem = {
  id: string
  role: "user" | "assistant" | "error"
  text: string
  dots?: AssistantDot[]
  chips?: AssistantChip[]
  toolsUsed?: AssistantToolUsed[]
  createdAt: number
}
