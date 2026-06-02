import type { AgentResponse, ClientStartRequest } from '@/types/conversation';

export async function inviteCloudAgent(
  requesterId: string,
  channelName: string,
): Promise<AgentResponse | null> {
  const res = await fetch('/api/invite-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester_id: requesterId,
      channel_name: channelName,
    } satisfies ClientStartRequest),
  });

  if (!res.ok) {
    console.error('[invite-cloud-agent] failed:', await res.text());
    return null;
  }

  return res.json() as Promise<AgentResponse>;
}
