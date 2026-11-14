// Serves the storage stub's files (F12): what an R2 presigned URL is in production. Signed GET
// and HEAD (with Range, so audio can seek) and signed PUT; anything unsigned, tampered with or
// expired is 403. Development with `PROVIDERS=stub` only; 404 otherwise.
import { handleLocalStorageRequest } from "@vidcosmos/integrations";
import { getLocalStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function handle(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const store = process.env.NODE_ENV === "production" ? null : getLocalStorage();
  if (!store) return new Response(null, { status: 404 });
  const { key } = await params;
  return handleLocalStorageRequest(store, request, key.join("/"));
}

export { handle as GET, handle as HEAD, handle as PUT };
