// The email sender for this server: the stub (server log and dev outbox) or Resend.
import {
  createResendEmailSender,
  createStubEmailSender,
  type EmailSender,
} from "@vidcosmos/integrations";
import { env } from "@/env";
import { selectProvider } from "./providers";

export const email: EmailSender = selectProvider(env, "email", {
  stub: () => createStubEmailSender(),
  // The env schema requires both when email is live.
  live: (live) =>
    createResendEmailSender({ apiKey: live.RESEND_API_KEY ?? "", from: live.EMAIL_FROM ?? "" }),
});
