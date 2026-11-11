// The component gallery: every component with the same examples as its preview in
// design/design-system/previews, in light and dark. Development only.
//
// `?frame=Button-light` shows one frame alone at the top-left corner, like the preview
// images, so screenshots can be compared pixel for pixel.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "Components · Vidcosmos" };

export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<{ frame?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { frame } = await searchParams;
  return <Gallery frame={frame} />;
}
