// A reference page for the design tokens: colours, type, spacing, radii, shadows and logos,
// in both themes side by side. Development only.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { designTokens as tokens, isSemanticColor, type ColorToken } from "@vidcosmos/config/tokens";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import type { Theme } from "@/lib/theme";
import { ThemeSwitcher } from "./theme-switcher";

export const metadata: Metadata = { title: "Design tokens · Vidcosmos" };

type TypeStyle = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
  sample: string;
  usage: string;
};
type TypeGroup = { name: string; family: string; styles: TypeStyle[] };

const colorGroups: { title: string; match: (name: string) => boolean }[] = [
  {
    title: "Grounds",
    match: (n) => n === "bg" || n.startsWith("surface") || n === "stage" || n === "scrim",
  },
  { title: "Text", match: (n) => n.startsWith("ink") },
  { title: "Brand", match: (n) => n.includes("brand") || n === "focus-ring" },
  { title: "Highlight", match: (n) => n.includes("highlight") },
  { title: "Status", match: (n) => /^(success|warning|danger|info|on-danger)/.test(n) },
  { title: "Lines", match: (n) => n.startsWith("line") },
];

function groupColors(tokens: ColorToken[]) {
  const semantic = tokens.filter(isSemanticColor);
  const groups = colorGroups.map((group) => ({
    title: group.title,
    tokens: semantic.filter((token) => group.match(token.name)),
  }));
  const grouped = new Set(groups.flatMap((group) => group.tokens.map((token) => token.name)));
  const rest = semantic.filter((token) => !grouped.has(token.name));
  return rest.length > 0 ? [...groups, { title: "Other", tokens: rest }] : groups;
}

// Tailwind only generates classes it finds written out in the source, so the shadow
// utilities are listed literally here rather than built from the token name.
const shadowClasses: Record<string, string> = {
  "shadow-sm": "shadow-sm",
  "shadow-md": "shadow-md",
  "shadow-lg": "shadow-lg",
};

/** "{slate-50}" → "slate-50"; a literal value stays as it is. */
const alias = (value: string) => value.replace(/^\{(.+)\}$/, "$1");

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="h3">{title}</h3>
      {children}
    </section>
  );
}

function ThemePanel({ theme }: { theme: Theme }) {
  const typeGroups = tokens.type.groups as TypeGroup[];

  return (
    <section
      data-theme={theme}
      data-testid={`panel-${theme}`}
      className="flex min-w-0 flex-col gap-10 rounded-xl border border-line bg-bg p-4 text-ink md:p-6"
    >
      <header className="flex flex-col gap-1">
        <p className="overline uppercase text-brand-text">{theme === "light" ? "Light" : "Dark"}</p>
        <h2 className="h2">{theme === "light" ? "Lagoon Classic" : "Lagoon Night"}</h2>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-6 rounded-lg border border-line bg-surface p-6">
          <LogoFull reversed={theme === "dark"} width={196} height={33} />
          <LogoMark width={44} height={44} title="" />
        </div>
      </Section>

      {groupColors(tokens.color.tokens).map((group) => (
        <Section key={group.title} title={group.title}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {group.tokens.map((token) => (
              <li
                key={token.name}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface p-3"
              >
                <span
                  aria-hidden
                  className="size-10 shrink-0 rounded-md border border-line"
                  style={{ background: `var(--${token.name})` }}
                />
                <span className="flex min-w-0 flex-col">
                  <code className="label">{token.name}</code>
                  <span className="small tabular-nums text-ink-muted">
                    {alias(token.value[theme])}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Type">
        <div className="flex flex-col gap-6">
          {typeGroups.flatMap((group) =>
            group.styles.map((style) => (
              <div key={style.name} className="flex flex-col gap-1 border-b border-line pb-4">
                <p
                  className={`${style.name} ${style.name === "overline" ? "uppercase" : ""} break-words`}
                  lang={style.name.startsWith("hi-") ? "hi" : undefined}
                >
                  {style.sample}
                </p>
                <p className="small tabular-nums text-ink-muted">
                  <code>{style.name}</code> · {style.fontSize}/{style.lineHeight} ·{" "}
                  {style.fontWeight}
                  {style.letterSpacing ? ` · ${style.letterSpacing}` : ""}
                </p>
              </div>
            )),
          )}
        </div>
      </Section>

      <Section title="Spacing">
        <ul className="flex flex-col gap-2">
          {tokens.spacing.tokens.map((token) => (
            <li key={token.name} className="flex items-center gap-3">
              <code className="small w-20 shrink-0 tabular-nums text-ink-muted">{token.name}</code>
              <span
                className="h-3 rounded-full bg-brand"
                style={{ width: `var(--${token.name})` }}
              />
              <span className="small tabular-nums text-ink-muted">{token.value}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Radii">
        <ul className="flex flex-wrap gap-4">
          {tokens.radius.tokens.map((token) => (
            <li key={token.name} className="flex flex-col items-center gap-2">
              <span
                className="size-16 border border-brand-soft-line bg-brand-soft"
                style={{ borderRadius: `var(--${token.name})` } as CSSProperties}
              />
              <code className="small text-ink-muted">{token.name.replace("radius-", "")}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Shadows">
        <ul className="flex flex-wrap gap-6">
          {tokens.shadow.tokens.map((token) => (
            <li
              key={token.name}
              className={`${shadowClasses[token.name] ?? ""} flex h-20 w-32 items-center justify-center rounded-lg bg-surface-raised`}
            >
              <code className="small text-ink-muted">{token.name}</code>
            </li>
          ))}
        </ul>
      </Section>
    </section>
  );
}

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-content flex-col gap-8 px-4 py-10 md:px-10">
      <header className="flex flex-col gap-4">
        <h1 className="h1">Design tokens</h1>
        <p className="body max-w-reading text-ink-secondary">
          Every colour, type style, spacing step, radius and shadow from{" "}
          <code>design/design-system/tokens.json</code>, in both themes.
        </p>
        <ThemeSwitcher />
      </header>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ThemePanel theme="light" />
        <ThemePanel theme="dark" />
      </div>
    </main>
  );
}
