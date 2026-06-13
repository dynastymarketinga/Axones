import { AxonesApiError, type AxonesToolResult } from "../types.js";

export function ok<T>(payload: Omit<AxonesToolResult<T>, "ok" | "error">): AxonesToolResult<T> {
  return { ok: true, ...payload };
}

export function fail(error: string): AxonesToolResult {
  return { ok: false, error };
}

export function fromError(err: unknown): AxonesToolResult {
  if (err instanceof AxonesApiError) {
    const detail = err.status > 0 ? ` (HTTP ${err.status})` : "";
    return { ok: false, error: `${err.message}${detail}` };
  }
  if (err instanceof Error) return { ok: false, error: err.message };
  return { ok: false, error: String(err) };
}
