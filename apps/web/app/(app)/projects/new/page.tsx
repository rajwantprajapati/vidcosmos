import { toUsageDto } from "@vidcosmos/spec/api";
import type { Metadata } from "next";
import { LimitNotice } from "@/components/library/limit-notice";
import { Placeholder } from "@/components/shell/page-header";
import { requireSession } from "@/lib/session";
import { usageView } from "@/lib/usage";

export const metadata: Metadata = { title: "New video · Vidcosmos" };

// F14 turns this into "create the project, then open step 1 (/projects/[id]/idea)", and must
// refuse at the monthly limit with the reset date, as this placeholder already says.
export default async function NewVideoPage() {
  const { user, workspace } = await requireSession("/projects/new");
  const { usage, resetsOn, allowance } = usageView(
    toUsageDto(workspace, new Date()),
    user.timeZone,
  );
  return (
    <>
      <Placeholder title="New video">
        Describe a video, pick its type and format, and Vidcosmos writes the script.
      </Placeholder>
      {allowance.reached ? (
        <LimitNotice limit={{ max: usage.videos.max, resetsOn }} className="max-w-reading" />
      ) : null}
    </>
  );
}
