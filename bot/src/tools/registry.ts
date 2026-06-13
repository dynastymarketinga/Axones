import type { ZodRawShape, ZodTypeAny, z } from "zod";

import type { AxonesConfig } from "../config.js";
import type { AxonesApiClient } from "../api/client.js";
import type { AxonesToolResult } from "../types.js";

export interface ToolDeps {
  config: AxonesConfig;
  api: AxonesApiClient;
}

export interface ToolDefinition<S extends ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  inputShape: S;
  handler: (
    input: z.infer<z.ZodObject<S>>,
    deps: ToolDeps,
  ) => Promise<AxonesToolResult>;
}

export type AnyToolDefinition = ToolDefinition<Record<string, ZodTypeAny>>;

export function defineTool<S extends ZodRawShape>(
  tool: ToolDefinition<S>,
): AnyToolDefinition {
  return tool as unknown as AnyToolDefinition;
}
