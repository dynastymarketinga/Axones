import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { AxonesApiClient } from "./api/client.js";
import { loadConfig } from "./config.js";
import { allTools, type ToolDeps } from "./tools/index.js";
import { fromError } from "./util/result.js";

const PACKAGE_NAME = "axones-assistant";
const PACKAGE_VERSION = "0.1.0";

export function createServer(): { server: McpServer; deps: ToolDeps } {
  const config = loadConfig();
  const api = new AxonesApiClient(config);
  const deps: ToolDeps = { config, api };

  const server = new McpServer({
    name: PACKAGE_NAME,
    version: PACKAGE_VERSION,
  });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title ?? tool.name,
        description: tool.description,
        inputSchema: tool.inputShape,
      },
      async (args) => {
        let result;
        try {
          result = await tool.handler(args as never, deps);
        } catch (err) {
          result = fromError(err);
        }
        const text = JSON.stringify(result, null, 2);
        return {
          content: [{ type: "text" as const, text }],
          isError: !result.ok,
        };
      },
    );
  }

  return { server, deps };
}
