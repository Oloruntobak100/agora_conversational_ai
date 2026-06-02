import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getMcpAuthToken } from "@/lib/env";
import { createNexoraMcpServer } from "./create-nexora-mcp-server";

function verifyMcpAuth(request: Request): boolean {
  const expected = getMcpAuthToken();
  if (!expected) return true;

  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.slice("Bearer ".length) === expected;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (!verifyMcpAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createNexoraMcpServer();
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
