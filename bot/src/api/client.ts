import type { AxonesConfig } from "../config.js";
import { AxonesApiError } from "../types.js";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

export class AxonesApiClient {
  constructor(private readonly config: AxonesConfig) {}

  hasToken(): boolean {
    return this.config.apiToken.length > 0;
  }

  baseUrl(): string {
    return this.config.apiBaseUrl;
  }

  async get<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const signal = opts.signal ?? controller.signal;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: this.headers(),
        signal,
      });
      return await this.handleResponse<T>(res);
    } catch (err) {
      if (err instanceof AxonesApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AxonesApiError(
          `Timeout (${this.config.timeoutMs}ms) llamando ${path}`,
          0,
          null,
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new AxonesApiError(`Error de red llamando ${path}: ${msg}`, 0, null);
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>,
  ): string {
    const safePath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.config.apiBaseUrl}${safePath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.config.apiToken) {
      headers.Authorization = `Bearer ${this.config.apiToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!res.ok) {
      const message = this.extractErrorMessage(parsed) ?? `HTTP ${res.status}`;
      throw new AxonesApiError(message, res.status, parsed);
    }
    return parsed as T;
  }

  private extractErrorMessage(body: unknown): string | null {
    if (!body || typeof body !== "object") return null;
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (obj.errors && typeof obj.errors === "object") {
      const first = Object.values(obj.errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    }
    return null;
  }
}
