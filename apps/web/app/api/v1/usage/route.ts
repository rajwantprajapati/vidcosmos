// GET /api/v1/usage: usage against the workspace's limits (API §3 Usage, §4).
import { readUsage } from "@vidcosmos/db";
import { apiRoute } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = apiRoute(async ({ workspace }) => readUsage(getDb(), workspace));
