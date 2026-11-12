// Sets this month's video counters on a user's workspace, in the development database.
//   node e2e/support/set-videos-used.ts <email> <used> [reserved]
// Run by the e2e tests as a separate process: the MongoDB driver doesn't load inside
// Playwright's test runner.
import { createMongoClient, databaseOf } from "@vidcosmos/db";

const [email, used, reserved = "0"] = process.argv.slice(2);
const uri = process.env.MONGODB_URI;
if (!email || !used || !uri) {
  console.error("Usage: set-videos-used.ts <email> <used> [reserved], with MONGODB_URI set");
  process.exit(1);
}

const client = createMongoClient(uri);
try {
  const db = databaseOf(client, uri);
  const user = await db.collection("user").findOne({ email: email.toLowerCase() });
  if (!user) throw new Error(`No user ${email}`);
  const result = await db
    .collection("workspaces")
    .updateOne(
      { ownerId: user._id },
      { $set: { "usage.videosUsed": Number(used), "usage.videosReserved": Number(reserved) } },
    );
  if (result.matchedCount !== 1) throw new Error(`No workspace for ${email}`);
} finally {
  await client.close();
}
