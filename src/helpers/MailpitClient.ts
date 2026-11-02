import { env } from '../config/env.js';

interface MailpitMessage {
  ID: string;
  MessageID: string;
  From: { Name: string; Address: string };
  To: { Name: string; Address: string }[];
  Subject: string;
  Snippet: string;
}

interface MailpitSearchResponse {
  total: number;
  messages: MailpitMessage[];
}

interface MailpitMessageDetail {
  ID: string;
  Text: string;
  HTML: string;
  Subject: string;
}

export class MailpitClient {
  private baseUrl: string;
  private seen = new Set<string>();

  constructor(baseUrl: string = env.MAILPIT_API_URL) {
    this.baseUrl = baseUrl;
  }

  async deleteAllMessages(): Promise<void> {
    // Compatibility hook: retain all mail; unique-recipient searches replace inbox deletion.
    // Previously returned messages remain excluded, including across password-reset stages.
  }

  async searchMessages(query: string): Promise<MailpitSearchResponse> {
    const url = `${this.baseUrl}/api/v1/search?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mailpit search failed: HTTP ${response.status}`);
    return response.json() as Promise<MailpitSearchResponse>;
  }

  async getMessage(id: string): Promise<MailpitMessageDetail> {
    const response = await fetch(`${this.baseUrl}/api/v1/message/${id}`);
    if (!response.ok) throw new Error(`Mailpit message failed: HTTP ${response.status}`);
    return response.json() as Promise<MailpitMessageDetail>;
  }

  // Treat every message the query matches now as already returned, so a later waitForMessage only returns mail
  // that arrives afterwards (a recipient that is not unique to the run may already have older mail).
  async ignoreExisting(query: string): Promise<void> {
    if (!/(?:^|\s)to:[^\s]+/.test(query)) throw new Error('Mailpit query must name a run-owned recipient');
    for (const message of (await this.searchMessages(query)).messages || []) this.seen.add(message.ID);
  }

  async waitForMessage(
    query: string,
    { timeoutMs = 30_000, pollIntervalMs = 1_000 } = {},
  ): Promise<MailpitMessageDetail> {
    if (!/(?:^|\s)to:[^\s]+/.test(query)) throw new Error('Mailpit query must name a run-owned recipient');
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = await this.searchMessages(query);
      const next = (result.messages || []).find(message => !this.seen.has(message.ID));
      if (next) {
        const detail = await this.getMessage(next.ID);
        this.seen.add(next.ID);
        return detail;
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(`Mailpit: no message matching "${query}" within ${timeoutMs}ms`);
  }

  extractOtp(body: string): string {
    const codes = [...new Set(body.match(/(?<![0-9])[0-9]{6}(?![0-9])/g) || [])];
    if (codes.length !== 1) throw new Error('Email must contain exactly one distinct six-digit OTP');
    return codes[0];
  }

  extractValidationToken(messageBody: string): string {
    // The validation email contains a link like:
    //   https://portal.example.com/user-validation?token=eyJhbG...
    const match = messageBody.match(/[?&]token=([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)/);
    if (!match) {
      throw new Error('Could not extract validation token from email body');
    }
    return match[1];
  }

  extractResetPasswordToken(messageBody: string): string {
    // The reset email contains a link like:
    //   https://portal.example.com/reset-password/eyJhbG...  (URL-encoded JWT)
    const match = messageBody.match(/reset-password\/([A-Za-z0-9_\-%.]+\.[A-Za-z0-9_\-%.]+\.[A-Za-z0-9_\-%.]+)/);
    if (!match) {
      throw new Error('Could not extract reset password token from email body');
    }
    return decodeURIComponent(match[1]);
  }
}
