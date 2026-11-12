// The app's sections, shared by the desktop sidebar and the phone tab bar.
import { Calendar, LayoutGrid, type LucideIcon, Plus, SlidersHorizontal } from "lucide-react";

export type NavItem = { key: string; label: string; href: string; icon: LucideIcon };

export const library: NavItem = {
  key: "library",
  label: "Library",
  href: "/library",
  icon: LayoutGrid,
};
export const newVideo: NavItem = {
  key: "new",
  label: "New video",
  href: "/projects/new",
  icon: Plus,
};
export const posts: NavItem = { key: "posts", label: "Posts", href: "/posts", icon: Calendar };
export const settings: NavItem = {
  key: "settings",
  label: "Settings",
  href: "/settings",
  icon: SlidersHorizontal,
};

/** Sidebar sections; "New video" is the button above them. */
export const sidebarItems = [library, posts, settings];
/** Phone tabs, in the design's order. */
export const tabItems = [library, newVideo, posts, settings];

/** A project's own pages: /projects/<ObjectId> and below. */
const projectPage = /^\/projects\/[0-9a-f]{24}(\/|$)/;

/**
 * A section is current on its own page and every page under it. Project pages belong to the
 * library; a path that is no real page (a 404) marks no section.
 */
export function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.key === "new") return pathname === "/projects/new";
  if (item.key === "library") return pathname === "/library" || projectPage.test(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** "RP" for "Rajwant Prajapati", "A" for "Asha". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1);
  return letters.map((word) => Array.from(word ?? "")[0]?.toUpperCase() ?? "").join("") || "?";
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;
