import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createResendEmailSender,
  createStubEmailSender,
  EmailSendError,
  type EmailMessage,
  stubOutbox,
} from "./email.ts";

const message: EmailMessage = {
  kind: "verify_email",
  to: "Asha@Example.com",
  subject: "Confirm your email",
  text: "Open https://app.test/verify?token=abc",
  html: "<p>Open the link</p>",
  link: "https://app.test/verify?token=abc",
};

describe("stub email sender", () => {
  beforeEach(() => stubOutbox.clear());

  it("logs the message and its link instead of sending it", async () => {
    const lines: string[] = [];
    await createStubEmailSender((line) => lines.push(line)).send(message);
    expect(lines.join("\n")).toContain("verify_email to Asha@Example.com");
    expect(lines.join("\n")).toContain("https://app.test/verify?token=abc");
  });

  it("keeps sent messages in the outbox, newest first, by address in any case", async () => {
    const sender = createStubEmailSender(() => {});
    await sender.send(message);
    await sender.send({ ...message, kind: "reset_password", subject: "Reset" });
    await sender.send({ ...message, to: "someone@else.com" });
    expect(stubOutbox.list("asha@example.com").map((m) => m.kind)).toEqual([
      "reset_password",
      "verify_email",
    ]);
    expect(stubOutbox.list()).toHaveLength(3);
  });
});

describe("Resend email sender", () => {
  it("posts the message to Resend with the API key", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    await createResendEmailSender({
      apiKey: "re_test",
      from: "Vidcosmos <hi@vidcosmos.app>",
      fetch,
    }).send(message);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "Vidcosmos <hi@vidcosmos.app>",
      to: ["Asha@Example.com"],
      subject: "Confirm your email",
    });
  });

  it("throws with the status only when Resend refuses", async () => {
    const fetch = vi.fn(async () => new Response('{"message":"bad"}', { status: 422 }));
    const send = createResendEmailSender({ apiKey: "k", from: "a@b.co", fetch }).send(message);
    await expect(send).rejects.toEqual(new EmailSendError(422));
  });
});
