"use client";

import type { ReactNode } from "react";
import {
  Badge,
  Button,
  Card,
  ChatMessage,
  Chip,
  Icon,
  iconNames,
  Logo,
  ProgressBar,
  PromptComposer,
  ProposalCard,
  SceneRow,
  SegmentedControl,
  TextField,
  Toast,
  UsageMeter,
  VideoCard,
} from "@/components/ui";
import type { Theme } from "@/lib/theme";
import { defaultVideoTypes } from "@/components/ui/prompt-composer";

const noop = () => {};

/** The examples from each preview image, in the same order. */
const examples: { name: string; render: () => ReactNode }[] = [
  {
    name: "Button",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Button icon="sparkles">Generate video</Button>
        <Button variant="secondary">Save version</Button>
        <Button variant="ghost" iconEnd="arrow-right">
          Preview
        </Button>
        <Button variant="danger">Delete video</Button>
        <Button loading>Generating…</Button>
        <Button variant="secondary" size="sm">
          Dismiss
        </Button>
      </div>
    ),
  },
  {
    name: "Icon",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        {iconNames.map((name) => (
          <Icon key={name} name={name} size={24} label={name} />
        ))}
      </div>
    ),
  },
  {
    name: "TextField",
    render: () => (
      <div className="flex max-w-[520px] flex-col gap-4">
        <TextField
          label="Topic"
          defaultValue="How vaccines train your immune system"
          helper="3 to 500 characters. Be specific about the audience."
        />
        <TextField label="Caption" defaultValue="Hi" error="Add at least 3 characters." />
        <TextField
          label="Notes (optional)"
          multiline
          placeholder="Paste your own facts or a reference to follow"
        />
      </div>
    ),
  },
  {
    name: "SegmentedControl",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Format"
          options={[
            { value: "9:16", label: "9:16" },
            { value: "16:9", label: "16:9" },
            { value: "1:1", label: "1:1" },
          ]}
        />
        <SegmentedControl
          label="Length"
          defaultValue="60"
          options={[
            { value: "30", label: "30 s" },
            { value: "60", label: "60 s" },
            { value: "90", label: "90 s" },
          ]}
        />
        <SegmentedControl
          label="Language"
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: "हिंदी", lang: "hi" },
          ]}
        />
      </div>
    ),
  },
  {
    name: "Chip",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        {defaultVideoTypes.map((type) => (
          <Chip key={type} selected={type === "Product ad"}>
            {type}
          </Chip>
        ))}
      </div>
    ),
  },
  {
    name: "Badge",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="success" icon="check">
          Ready
        </Badge>
        <Badge tone="brand">Generating</Badge>
        <Badge tone="warning" icon="clock">
          Scheduled
        </Badge>
        <Badge tone="danger" icon="alert">
          Failed
        </Badge>
        <Badge>Draft</Badge>
        <Badge tone="info">Tip</Badge>
        <Badge tone="highlight">New</Badge>
      </div>
    ),
  },
  {
    name: "ProgressBar",
    render: () => (
      <div className="flex max-w-[520px] flex-col gap-4">
        <ProgressBar value={58} label="Recording narration (4 of 7 scenes)" />
        <ProgressBar value={92} label="Rendering 1080p" />
      </div>
    ),
  },
  {
    name: "Toast",
    render: () => (
      <div className="flex max-w-[520px] flex-col gap-4">
        <Toast actionLabel="Undo" onAction={noop}>
          Version 4 saved
        </Toast>
        <Toast tone="success" actionLabel="View post" onAction={noop}>
          Posted to Instagram
        </Toast>
        <Toast tone="danger" onClose={noop}>
          Couldn’t reach Instagram. We’ll retry in 5 minutes.
        </Toast>
      </div>
    ),
  },
  {
    name: "Card",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Card className="w-[310px]">
          <h3 className="h3">Voice</h3>
          <p className="body-sm mt-1.5 text-ink-muted">Indian female narrator, normal speed.</p>
        </Card>
        <Card as="button" interactive selected className="w-[310px] text-left">
          <h3 className="h3">The 3-step journey</h3>
          <p className="body-sm mt-1.5 text-ink-secondary">
            Follow one payment from phone to bank in three hops.
          </p>
        </Card>
      </div>
    ),
  },
  {
    name: "Logo",
    render: () => (
      <div className="flex flex-wrap items-center gap-3">
        <Logo size={40} />
        <Logo variant="mark" size={40} />
        <Logo variant="mark" size={24} />
      </div>
    ),
  },
  {
    name: "PromptComposer",
    render: () => (
      <PromptComposer
        className="max-w-[520px]"
        defaultValue="A 20-second reel for a handmade candle brand. Warm light, slow close-ups, upbeat music."
        defaultType="Product ad"
      />
    ),
  },
  {
    name: "VideoCard",
    render: () => (
      <div className="grid grid-cols-[repeat(auto-fill,216px)] gap-4">
        <VideoCard
          title="How UPI moves money"
          type="Explainer"
          duration="0:58"
          status="ready"
          theme="midnight"
          caption={{ before: "your bank", word: "asks", after: "NPCI" }}
          href="#video-card"
        />
        <VideoCard
          title="Ember & Wick candle launch"
          headline="Ember & Wick"
          type="Product ad"
          duration="0:20"
          status="scheduled"
          statusLabel="Posts 6:30 pm"
          theme="sunset"
        />
        <VideoCard
          title="Ladakh trip reel"
          type="Travel"
          duration="0:30"
          status="generating"
          statusLabel="Generating 64%"
          progress={64}
          theme="ocean"
        />
        <VideoCard
          title="Monday motivation"
          headline="“Start before you are ready.”"
          type="Quote"
          duration="0:15"
          status="draft"
          theme="paper"
        />
      </div>
    ),
  },
  {
    name: "SceneRow",
    render: () => (
      <div className="flex max-w-[360px] flex-col gap-1">
        <SceneRow index={1} title="What is UPI?" template="Title" duration="5.2 s" />
        <SceneRow
          index={2}
          title="How a payment travels"
          template="Flowchart"
          duration="9.8 s"
          selected
          edited
        />
        <SceneRow index={3} title="UPI vs cards" template="Comparison" duration="11.4 s" failed />
      </div>
    ),
  },
  {
    name: "ChatMessage",
    render: () => (
      <div className="flex max-w-[420px] flex-col gap-2">
        <ChatMessage role="user">
          Make the intro shorter and turn scene 3 into a timeline.
        </ChatMessage>
        <ChatMessage role="assistant">
          Sure. Do you want the timeline to start in 2016, when UPI launched?
        </ChatMessage>
      </div>
    ),
  },
  {
    name: "ProposalCard",
    render: () => (
      <div className="flex max-w-[520px] flex-col gap-3">
        <ProposalCard
          summary="I'll cut the intro to one sentence and rebuild scene 3 as a 4-step timeline."
          scenes="Scenes 1, 3"
          regeneratesVoice
          duration="52 s"
          onApply={noop}
          onDismiss={noop}
        />
        <ProposalCard
          summary="Switch the video to the ocean theme."
          scenes="All scenes"
          duration="58 s"
          status="applied"
          version={5}
        />
      </div>
    ),
  },
  {
    name: "UsageMeter",
    render: () => (
      <div className="flex flex-wrap gap-6">
        <UsageMeter className="w-[260px]" used={12} max={20} resetsOn="1 Dec" />
        <UsageMeter
          className="w-[260px]"
          used={17}
          max={20}
          label="Exports today"
          resetsOn="midnight"
        />
      </div>
    ),
  },
];

export const componentNames = examples.map((example) => example.name);

function Frame({ name, theme, children }: { name: string; theme: Theme; children: ReactNode }) {
  return (
    <div
      data-theme={theme}
      data-testid={`preview-${name}-${theme}`}
      className="box-border w-[960px] max-w-full bg-bg p-6 text-[16px] text-ink"
    >
      {children}
    </div>
  );
}

export function Gallery({ frame }: { frame?: string }) {
  if (frame) {
    const [name, theme] = frame.split("-") as [string, Theme];
    const example = examples.find((e) => e.name === name);
    if (!example || (theme !== "light" && theme !== "dark"))
      return <p className="p-6">Unknown frame.</p>;
    return (
      <Frame name={example.name} theme={theme}>
        {example.render()}
      </Frame>
    );
  }

  return (
    <main className="mx-auto flex max-w-[1008px] flex-col gap-12 px-4 py-10 md:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="h1">Components</h1>
        <p className="body max-w-reading text-ink-secondary">
          The 16 components from <code>design/design-system/components</code>, with the examples
          from their previews, in light and dark.
        </p>
      </header>
      {examples.map((example) => (
        <section key={example.name} id={example.name} className="flex flex-col gap-3">
          <h2 className="h2">{example.name}</h2>
          <Frame name={example.name} theme="light">
            {example.render()}
          </Frame>
          <Frame name={example.name} theme="dark">
            {example.render()}
          </Frame>
        </section>
      ))}
    </main>
  );
}
