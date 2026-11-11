// The auth pages: the brand panel and the form side by side, stacked on phones.
import type { ReactNode } from "react";
import { BrandPanel } from "@/components/auth/brand-panel";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-wrap bg-bg font-sans text-ink">
      <BrandPanel />
      <main className="box-border flex min-w-0 flex-[1_1_520px] items-center justify-center py-12 pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))]">
        {children}
      </main>
    </div>
  );
}
