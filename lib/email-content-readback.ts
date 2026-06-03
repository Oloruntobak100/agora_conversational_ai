/** Spoken read-back lines for email subject and body. */

export function formatSubjectForSpeech(subject: string): string {
  return subject.trim();
}

export function formatBodyForSpeech(body: string): string {
  return body.trim().replace(/\n+/g, " ");
}

export function buildSubjectReadBackLine(subject: string): string {
  return `The subject line is: ${formatSubjectForSpeech(subject)}. Is that subject okay?`;
}

export function buildBodyReadBackLine(body: string): string {
  const spoken = formatBodyForSpeech(body);
  const preview =
    spoken.length > 220 ? `${spoken.slice(0, 220).trim()}…` : spoken;
  return `The email body says: ${preview}. Is that message okay?`;
}

export function buildFullEmailContentReadBack(
  subject: string,
  body: string,
): string {
  return `${buildSubjectReadBackLine(subject)} Then: ${buildBodyReadBackLine(body)}`;
}
