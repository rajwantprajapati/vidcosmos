// Email: one interface, a stub for development and tests, and Resend for live.
//
// The stub sends nothing. It writes each message to the server log and keeps the last
// messages in memory (`stubOutbox`), so a developer can copy a link from the log and an
// end-to-end test can open it through the dev-only outbox route.

export type EmailKind = "verify_email" | "reset_password";

export type EmailMessage = {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  /** The link the email is about, if any (verification, reset). */
  link?: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export type OutboxEntry = EmailMessage & { sentAt: Date };

const outboxLimit = 200;

// On globalThis so every route bundle in one dev server sees the same outbox.
const store = globalThis as typeof globalThis & { __vidcosmosOutbox?: OutboxEntry[] };

/** The stub's sent messages, newest first. Development and tests only. */
export const stubOutbox = {
  list(to?: string): OutboxEntry[] {
    const all = store.__vidcosmosOutbox ?? [];
    const wanted = to?.trim().toLowerCase();
    return wanted ? all.filter((m) => m.to.toLowerCase() === wanted) : [...all];
  },
  clear(): void {
    store.__vidcosmosOutbox = [];
  },
};

export function createStubEmailSender(log: (line: string) => void = console.log): EmailSender {
  return {
    async send(message) {
      const outbox = (store.__vidcosmosOutbox ??= []);
      outbox.unshift({ ...message, sentAt: new Date() });
      outbox.length = Math.min(outbox.length, outboxLimit);
      log(
        `[email stub] ${message.kind} to ${message.to}: ${message.subject}` +
          (message.link ? `\n  ${message.link}` : ""),
      );
    },
  };
}

export class EmailSendError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Resend refused the email (HTTP ${status}).`);
    this.name = "EmailSendError";
    this.status = status;
  }
}

/** Live email through Resend's REST API. */
export function createResendEmailSender(options: {
  apiKey: string;
  from: string;
  fetch?: typeof fetch;
}): EmailSender {
  const doFetch = options.fetch ?? fetch;
  return {
    async send(message) {
      const response = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          tags: [{ name: "kind", value: message.kind }],
        }),
      });
      // The body may echo the address; only the status is reported.
      if (!response.ok) throw new EmailSendError(response.status);
    },
  };
}
