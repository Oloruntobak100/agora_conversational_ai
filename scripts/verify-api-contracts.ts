import { createHmac } from 'node:crypto';
import { AgoraClient, Agent } from 'agora-agent-server-sdk';
import { RtcTokenBuilder } from 'agora-token';
import { NextRequest } from 'next/server';
import {
  isAgentFarewellMessage,
  isInternalTranscriptMessage,
  isUserFarewellMessage,
} from '../lib/conversation-end';
import { verifyAgoraWebhookRequest } from '../lib/webhooks/verify-agora-signature';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

process.env.NEXT_PUBLIC_AGORA_APP_ID = '0123456789abcdef0123456789abcdef';
process.env.NEXT_AGORA_APP_CERTIFICATE = 'fedcba9876543210fedcba9876543210';
process.env.NEXT_PUBLIC_AGENT_UID = '123456';

async function verifyGenerateAgoraTokenRoute() {
  const { GET: generateAgoraToken } =
    await import('../app/api/generate-agora-token/route');
  const originalBuildTokenWithRtm = RtcTokenBuilder.buildTokenWithRtm;
  let tokenBuilderArgs: unknown[] | null = null;

  RtcTokenBuilder.buildTokenWithRtm = ((...args: unknown[]) => {
    tokenBuilderArgs = args;
    return 'mock-rtc-rtm-token';
  }) as typeof RtcTokenBuilder.buildTokenWithRtm;

  try {
    const request = new NextRequest(
      'http://localhost:3000/api/generate-agora-token?uid=4321&channel=test-channel',
    );
    const response = await generateAgoraToken(request);
    const body = await getJson(response);

    assert(
      response.status === 200,
      'GET /api/generate-agora-token should return 200',
    );
    assert(
      body.token === 'mock-rtc-rtm-token',
      'GET /api/generate-agora-token should return the built token',
    );
    assert(
      body.uid === '4321',
      'GET /api/generate-agora-token should preserve the requested uid',
    );
    assert(
      body.channel === 'test-channel',
      'GET /api/generate-agora-token should preserve the requested channel',
    );

    assert(
      Array.isArray(tokenBuilderArgs),
      'GET /api/generate-agora-token should call buildTokenWithRtm',
    );
    assert(
      tokenBuilderArgs?.[2] === 'test-channel',
      'buildTokenWithRtm should use the requested channel',
    );
    assert(
      tokenBuilderArgs?.[3] === '4321',
      'buildTokenWithRtm should receive the requested uid as account string',
    );
  } finally {
    RtcTokenBuilder.buildTokenWithRtm = originalBuildTokenWithRtm;
  }
}

async function verifyInviteAgentValidation() {
  const { POST: inviteAgent } = await import('../app/api/invite-agent/route');
  const request = new NextRequest('http://localhost:3000/api/invite-agent', {
    body: JSON.stringify({ channel_name: 'missing-requester' }),
    method: 'POST',
  });
  const response = await inviteAgent(request);
  const body = await getJson(response);

  assert(
    response.status === 400,
    'POST /api/invite-agent should reject missing fields',
  );
  assert(
    body.error === 'channel_name and requester_id are required',
    'POST /api/invite-agent should explain validation failure',
  );
}

async function verifyInviteAgentSuccess() {
  const { POST: inviteAgent } = await import('../app/api/invite-agent/route');
  const originalCreateSession = Agent.prototype.createSession;
  let capturedSessionConfig: {
    channel?: string;
    agentUid?: string;
    remoteUids?: string[];
  } | null = null;

  Agent.prototype.createSession = ((_: unknown, sessionConfig: unknown) => {
    capturedSessionConfig = sessionConfig as {
      channel?: string;
      agentUid?: string;
      remoteUids?: string[];
    };
    return {
      start: async () => 'mock-agent-id',
      say: async () => {},
      update: async () => {},
    };
  }) as unknown as typeof Agent.prototype.createSession;

  try {
    const request = new NextRequest('http://localhost:3000/api/invite-agent', {
      body: JSON.stringify({
        requester_id: 'user-4321',
        channel_name: 'test-channel',
      }),
      method: 'POST',
    });
    const response = await inviteAgent(request);
    const body = await getJson(response);

    assert(
      response.status === 200,
      'POST /api/invite-agent should return 200 on success',
    );
    assert(
      body.agent_id === 'mock-agent-id',
      'POST /api/invite-agent should return the started agent id',
    );
    assert(
      body.state === 'RUNNING',
      'POST /api/invite-agent should return RUNNING state',
    );
    assert(
      capturedSessionConfig !== null,
      'POST /api/invite-agent should call createSession',
    );
    const sessionConfig = capturedSessionConfig as {
      channel?: string;
      agentUid?: string;
      remoteUids?: string[];
    };

    assert(
      sessionConfig.channel === 'test-channel',
      'POST /api/invite-agent should pass the requested channel to createSession',
    );
    assert(
      sessionConfig.agentUid === '123456',
      'POST /api/invite-agent should use NEXT_PUBLIC_AGENT_UID for the agent session',
    );
    assert(
      JSON.stringify(sessionConfig.remoteUids) ===
        JSON.stringify(['user-4321']),
      'POST /api/invite-agent should scope the session to the requesting user',
    );
  } finally {
    Agent.prototype.createSession = originalCreateSession;
  }
}

async function verifyStopConversationValidation() {
  const { POST: stopConversation } =
    await import('../app/api/stop-conversation/route');
  const request = new NextRequest(
    'http://localhost:3000/api/stop-conversation',
    {
      body: JSON.stringify({}),
      method: 'POST',
    },
  );
  const response = await stopConversation(request);
  const body = await getJson(response);

  assert(
    response.status === 400,
    'POST /api/stop-conversation should reject missing agent_id',
  );
  assert(
    body.error === 'agent_id is required',
    'POST /api/stop-conversation should explain validation failure',
  );
}

async function verifyStopConversationSuccess() {
  const { POST: stopConversation } =
    await import('../app/api/stop-conversation/route');
  const originalStopAgent = AgoraClient.prototype.stopAgent;
  let stoppedAgentId: string | null = null;

  AgoraClient.prototype.stopAgent = async function (
    this: AgoraClient,
    agentId: string,
  ) {
    stoppedAgentId = agentId;
  } as typeof AgoraClient.prototype.stopAgent;

  try {
    const request = new NextRequest(
      'http://localhost:3000/api/stop-conversation',
      {
        body: JSON.stringify({ agent_id: 'mock-agent-id' }),
        method: 'POST',
      },
    );
    const response = await stopConversation(request);
    const body = await getJson(response);

    assert(
      response.status === 200,
      'POST /api/stop-conversation should return 200 on success',
    );
    assert(
      body.success === true,
      'POST /api/stop-conversation should return success',
    );
    assert(
      stoppedAgentId === 'mock-agent-id',
      'POST /api/stop-conversation should call stopAgent with the requested agent id',
    );
  } finally {
    AgoraClient.prototype.stopAgent = originalStopAgent;
  }
}

function verifyConversationEndHelpers() {
  assert(
    isAgentFarewellMessage('Have a wonderful day! Goodbye.'),
    'isAgentFarewellMessage should detect farewell',
  );
  assert(
    !isAgentFarewellMessage('Just checking in! Are you still there?'),
    'isAgentFarewellMessage should not treat check-in as farewell',
  );
  assert(
    isUserFarewellMessage("Goodbye. That's all."),
    'isUserFarewellMessage should detect user goodbye',
  );
  assert(
    isInternalTranscriptMessage(
      'The user has been silent. Say one short sentence wishing them a great day.',
    ),
    'isInternalTranscriptMessage should hide silence think prompts',
  );
}

async function verifyAgoraWebhookSignature() {
  const secret = 'test-webhook-secret';
  const body = '{"eventType":101,"noticeId":"n1"}';
  const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const headers = new Headers({ 'Agora-Signature-V2': sig });

  assert(
    verifyAgoraWebhookRequest(body, secret, headers),
    'verifyAgoraWebhookRequest should accept valid SHA256 signature',
  );
  assert(
    !verifyAgoraWebhookRequest(body, 'wrong-secret', headers),
    'verifyAgoraWebhookRequest should reject invalid secret',
  );
}

async function verifyWebhooksAgoraRoute() {
  const { POST: agoraWebhook } =
    await import('../app/api/webhooks/agora/route');
  const body = JSON.stringify({ eventType: 101, noticeId: 'contract-test' });
  const secret = 'contract-webhook-secret';
  process.env.AGORA_WEBHOOK_SECRET = secret;
  const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

  try {
    const request = new Request('http://localhost:3000/api/webhooks/agora', {
      body,
      headers: {
        'Agora-Signature-V2': sig,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const response = await agoraWebhook(request);
    const json = await getJson(response);

    assert(
      response.status === 200,
      'POST /api/webhooks/agora should return 200 for valid signature',
    );
    assert(
      json.ok === true,
      'POST /api/webhooks/agora should return ok: true',
    );
  } finally {
    delete process.env.AGORA_WEBHOOK_SECRET;
  }
}

async function verifyToolsRouteSuccess() {
  process.env.N8N_TOOL_WEBHOOK_URL = 'https://n8n.example/webhook/test';
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ speak: 'Workflow ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

  try {
    const { POST: toolsRoute } = await import('../app/api/tools/route');
    const request = new NextRequest('http://localhost:3000/api/tools', {
      body: JSON.stringify({
        tool: 'invoke_workflow',
        args: {
          channel_name: 'tool-channel',
          requester_id: 'user-99',
          query: 'ping',
        },
      }),
      method: 'POST',
    });
    const response = await toolsRoute(request);
    const json = await getJson(response);

    assert(
      response.status === 200,
      'POST /api/tools should return 200 when n8n responds',
    );
    assert(json.ok === true, 'POST /api/tools should return ok: true');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.N8N_TOOL_WEBHOOK_URL;
  }
}

async function verifyInvitePipelineToolsGating() {
  const savedEnable = process.env.AGORA_ENABLE_TOOLS;
  const savedMcpUrl = process.env.NEXORA_MCP_PUBLIC_URL;
  const savedVercel = process.env.VERCEL_URL;

  delete process.env.AGORA_ENABLE_TOOLS;
  delete process.env.NEXORA_MCP_PUBLIC_URL;
  delete process.env.VERCEL_URL;

  const { buildInviteAgentPipeline } =
    await import('../lib/invite-agent-pipeline');

  const disabled = buildInviteAgentPipeline('contract', {
    channel: 'ch-off',
    requesterId: 'u1',
  });
  assert(
    disabled.config.toolsEnabled === false,
    'tools should be disabled without AGORA_ENABLE_TOOLS',
  );

  process.env.AGORA_ENABLE_TOOLS = 'true';
  process.env.NEXORA_MCP_PUBLIC_URL = 'https://nexora.example.com';

  const enabled = buildInviteAgentPipeline('contract', {
    channel: 'ch-on',
    requesterId: 'u1',
  });
  assert(
    enabled.config.toolsEnabled === true,
    'tools should be enabled with AGORA_ENABLE_TOOLS and public MCP URL',
  );

  if (savedEnable === undefined) delete process.env.AGORA_ENABLE_TOOLS;
  else process.env.AGORA_ENABLE_TOOLS = savedEnable;
  if (savedMcpUrl === undefined) delete process.env.NEXORA_MCP_PUBLIC_URL;
  else process.env.NEXORA_MCP_PUBLIC_URL = savedMcpUrl;
  if (savedVercel === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = savedVercel;
}

async function verifyMcpAuthRejection() {
  const savedToken = process.env.MCP_AUTH_TOKEN;
  process.env.MCP_AUTH_TOKEN = 'contract-mcp-token';

  try {
    const { handleMcpRequest } = await import('../lib/mcp/handle-mcp-request');
    const request = new Request('http://localhost:3000/api/mcp', {
      method: 'POST',
    });
    const response = await handleMcpRequest(request);

    assert(
      response.status === 401,
      'POST /api/mcp should reject missing Bearer when MCP_AUTH_TOKEN is set',
    );
  } finally {
    if (savedToken === undefined) delete process.env.MCP_AUTH_TOKEN;
    else process.env.MCP_AUTH_TOKEN = savedToken;
  }
}

async function main() {
  await verifyGenerateAgoraTokenRoute();
  await verifyInviteAgentValidation();
  await verifyInviteAgentSuccess();
  await verifyStopConversationValidation();
  await verifyStopConversationSuccess();
  verifyConversationEndHelpers();
  await verifyAgoraWebhookSignature();
  await verifyWebhooksAgoraRoute();
  await verifyToolsRouteSuccess();
  await verifyInvitePipelineToolsGating();
  await verifyMcpAuthRejection();

  console.log('API contract checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
