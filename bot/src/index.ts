#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer } from "./server.js";

async function main(): Promise<void> {
  const { server, deps } = createServer();

  if (!deps.api.hasToken()) {
    // stderr no interfiere con stdio MCP; ayuda a depurar configuración.
    process.stderr.write(
      "[axones-assistant] AVISO: AXONES_API_TOKEN está vacío. Las tools fallarán con HTTP 401 hasta que se configure.\n",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(
    `[axones-assistant] Fallo fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
