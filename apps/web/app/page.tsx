import { appInfo } from "@/lib/app-info";

// Placeholder until the marketing home page (F32) and design tokens (F03) land.
export default function Home() {
  return (
    <main>
      <h1>{appInfo.name}</h1>
      <p>{appInfo.tagline}</p>
    </main>
  );
}
