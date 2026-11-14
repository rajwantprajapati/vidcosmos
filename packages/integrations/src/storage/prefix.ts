// Prefix checks for `deletePrefix`: only whole folders this layout builds.
import { StorageKeyError } from "./keys.ts";

export function assertValidPrefix(prefix: string): string {
  const ok =
    /^(ws\/[0-9a-f]{24}\/|music\/|dev\/)([A-Za-z0-9._-]+\/)*$/.test(prefix) &&
    !prefix.split("/").some((part) => part === "." || part === "..");
  if (!ok) throw new StorageKeyError("That isn't a valid storage prefix.");
  return prefix;
}
