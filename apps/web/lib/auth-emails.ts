// The two account emails Better Auth sends. Plain, short and in the product's voice; the
// designed React Email templates come with notifications and email (F31).
import type { EmailMessage } from "@vidcosmos/integrations";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(paragraphs: string[], link: { url: string; label: string }) {
  const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return `${body}<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function verifyEmailMessage(
  user: { name: string; email: string },
  url: string,
): EmailMessage {
  const lines = [
    `Hi ${firstName(user.name)},`,
    "Confirm your email address to finish setting up Vidcosmos. The link works for 24 hours.",
  ];
  return {
    kind: "verify_email",
    to: user.email,
    subject: "Confirm your email for Vidcosmos",
    text: `${lines.join("\n\n")}\n\n${url}\n\nIf you didn't create an account, you can ignore this email.`,
    html: layout([...lines], { url, label: "Confirm email" }),
    link: url,
  };
}

export function resetPasswordMessage(
  user: { name: string; email: string },
  url: string,
): EmailMessage {
  const lines = [
    `Hi ${firstName(user.name)},`,
    "Someone asked to reset the password for your Vidcosmos account. The link works for 1 hour.",
  ];
  return {
    kind: "reset_password",
    to: user.email,
    subject: "Reset your Vidcosmos password",
    text: `${lines.join("\n\n")}\n\n${url}\n\nIf it wasn't you, ignore this email: your password stays the same.`,
    html: layout(lines, { url, label: "Choose a new password" }),
    link: url,
  };
}
