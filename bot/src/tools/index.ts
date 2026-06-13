import { analysisTools } from "./analysis.js";
import { contextTools } from "./context.js";
import { queryTools } from "./queries.js";
import type { AnyToolDefinition } from "./registry.js";

export const allTools: AnyToolDefinition[] = [
  ...queryTools,
  ...analysisTools,
  ...contextTools,
];

export type { AnyToolDefinition, ToolDeps } from "./registry.js";
