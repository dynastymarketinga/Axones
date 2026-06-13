export interface AxonesConfig {
  apiBaseUrl: string;
  apiToken: string;
  timeoutMs: number;
  spaBaseUrl: string | null;
}

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function loadConfig(): AxonesConfig {
  const apiBaseUrl = stripTrailingSlash(
    readEnv("AXONES_API_BASE_URL") ?? "http://127.0.0.1:8000/api",
  );
  const apiToken = readEnv("AXONES_API_TOKEN") ?? "";
  const timeoutRaw = readEnv("AXONES_API_TIMEOUT_MS");
  const timeoutMs = timeoutRaw ? Math.max(1000, Number(timeoutRaw) || 15000) : 15000;
  const spaBaseUrl = readEnv("AXONES_SPA_BASE_URL")
    ? stripTrailingSlash(readEnv("AXONES_SPA_BASE_URL")!)
    : null;

  return { apiBaseUrl, apiToken, timeoutMs, spaBaseUrl };
}
