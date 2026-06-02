import { handleMcpRequest } from "@/lib/mcp/handle-mcp-request";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
