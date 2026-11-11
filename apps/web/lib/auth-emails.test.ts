import { describe, expect, it } from "vitest";
import { resetPasswordMessage, verifyEmailMessage } from "./auth-emails";

const user = { name: "Asha <b>Rao</b>", email: "asha@example.com" };

describe("account emails", () => {
  it("verification carries the link, the address and how long it works", () => {
    const message = verifyEmailMessage(
      user,
      "http://localhost:3000/api/auth/verify-email?token=t&callbackURL=%2Fverify",
    );
    expect(message).toMatchObject({ kind: "verify_email", to: "asha@example.com" });
    expect(message.text).toContain("token=t");
    expect(message.text).toContain("24 hours");
    expect(message.link).toContain("token=t");
  });

  it("reset says 1 hour", () => {
    expect(resetPasswordMessage(user, "http://x/reset").text).toContain("1 hour");
  });

  it("escapes names and links in the HTML", () => {
    const message = verifyEmailMessage(user, 'http://x/?a=1&b="2"');
    expect(message.html).not.toContain("<b>");
    expect(message.html).toContain("&#38;b=&#34;2&#34;");
  });
});
