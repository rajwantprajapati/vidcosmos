"use client";

// "Edit scene" (F17): a dialog on desktop, a full screen on phones (MobileStoryboard: "tap a
// scene to edit it"). The template, the narration, and every on-screen field of the template
// with the words it appears on, from `sceneForm`. Each change that leaves the scene valid goes
// straight to the storyboard (and its autosave); a field left empty that needs text says so
// and nothing is saved until it's filled. A trigger the narrator doesn't say is saved, and
// shown as the issue to fix.
import {
  convertScene,
  type FormField,
  iconNames,
  type Scene,
  scene as sceneSchema,
  sceneForm,
  type SpecIssue,
  templateLabels,
  type TemplateName,
  templateNames,
  valueAt,
  type VideoSpec,
  withValueAt,
} from "@vidcosmos/spec/video";
import { ChevronLeft, X } from "lucide-react";
import { useId, useState } from "react";
import { Button, cn, Icon, TextField } from "@/components/ui";
import { Modal } from "./modal";

const selectClass =
  "box-border min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 font-sans text-[15px] text-ink focus:border-brand-text focus:outline-none disabled:opacity-45";

/** "content.items.0.text" as the form's path, "items[0].text". */
function formPath(path: PropertyKey[]): string {
  const [first, ...rest] = path;
  if (first !== "content") return String(first);
  return rest
    .map((key, i) => (typeof key === "number" ? `[${key}]` : `${i === 0 ? "" : "."}${String(key)}`))
    .join("");
}

/** What's wrong with a field, in words: only blanks and numbers get past the inputs' limits. */
function fieldErrors(candidate: unknown): Record<string, string> {
  const parsed = sceneSchema.safeParse(candidate);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = formPath(issue.path);
    if (errors[path]) continue;
    errors[path] =
      issue.code === "too_small" && issue.origin === "string"
        ? "Write something here."
        : issue.code === "too_big" && issue.origin === "string"
          ? `Use at most ${String(issue.maximum)} characters.`
          : issue.code === "invalid_type" && issue.expected === "number"
            ? "Enter a number."
            : issue.code === "too_small" && issue.origin === "number"
              ? "Use 0 or more."
              : issue.message;
  }
  return errors;
}

export function SceneEditor({
  scene,
  number,
  spec,
  issues,
  readOnly,
  onChange,
  onClose,
}: {
  scene: Scene;
  number: number;
  spec: VideoSpec;
  issues: SpecIssue[];
  readOnly: boolean;
  onChange: (scene: Scene) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  // What's typed, valid or not; the storyboard gets each valid version.
  const [draft, setDraft] = useState<Scene>(scene);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const content = draft.content as Record<string, unknown>;
  const hindi = spec.language === "hi";
  const problem = (path: string) => issues.find((issue) => issue.path === path)?.message;

  function apply(next: Scene) {
    setDraft(next);
    const found = fieldErrors(next);
    setErrors(found);
    if (Object.keys(found).length === 0) onChange(sceneSchema.parse(next));
  }

  const setContent = (path: string, value: unknown, alsoClear?: string) => {
    let next = withValueAt(content, path, value);
    if (alsoClear) next = withValueAt(next, alsoClear, undefined);
    apply({ ...draft, content: next } as Scene);
  };

  function switchTemplate(template: TemplateName) {
    // From the last valid version of the scene: what's half typed isn't converted.
    const converted = convertScene(sceneSchema.parse({ ...scene }), template);
    setDraft(converted);
    setErrors({});
    onChange(converted);
  }

  function renderField(field: FormField) {
    const value = valueAt(content, field.path);
    const error = errors[field.path];
    switch (field.kind) {
      case "text":
        return (
          <TextField
            key={field.path}
            label={field.label}
            value={typeof value === "string" ? value : ""}
            maxLength={field.max}
            disabled={readOnly}
            error={error}
            helper={field.required ? undefined : "Optional"}
            lang={spec.language}
            onChange={(event) => {
              const text = event.target.value;
              const cleared = text === "" && !field.required;
              setContent(
                field.path,
                cleared ? undefined : text,
                cleared ? field.trigger : undefined,
              );
            }}
          />
        );
      case "trigger": {
        const warning = problem(field.path);
        return (
          <div key={field.path} className="flex min-w-0 flex-col gap-1.5">
            <TextField
              label={field.label}
              value={typeof value === "string" ? value : ""}
              maxLength={40}
              disabled={readOnly}
              error={error}
              helper={
                warning
                  ? undefined
                  : field.required
                    ? "Words the narrator says"
                    : "Optional: empty shows it from the start"
              }
              lang={spec.language}
              controlClassName={warning ? "border-warning" : undefined}
              onChange={(event) => {
                const text = event.target.value;
                setContent(field.path, text === "" && !field.required ? undefined : text);
              }}
            />
            {warning && !error ? (
              <p className="m-0 flex items-start gap-1.5 text-[13px] leading-[18px] text-warning">
                <Icon name="alert" size={16} className="mt-px shrink-0" />
                {warning}
              </p>
            ) : null}
          </div>
        );
      }
      case "icon":
        return (
          <label key={field.path} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[14px] leading-5 font-semibold">{field.label}</span>
            <select
              value={typeof value === "string" ? value : ""}
              disabled={readOnly}
              onChange={(event) =>
                setContent(field.path, event.target.value === "" ? undefined : event.target.value)
              }
              className={selectClass}
            >
              {field.required ? null : <option value="">No icon</option>}
              {iconNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        );
      case "number":
        return (
          <TextField
            key={field.path}
            label={field.label}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={typeof value === "number" && Number.isFinite(value) ? String(value) : ""}
            disabled={readOnly}
            error={error}
            onChange={(event) => {
              const number = event.target.valueAsNumber;
              setContent(field.path, Number.isFinite(number) ? number : null);
            }}
          />
        );
      case "choice":
        return (
          <label key={field.path} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[14px] leading-5 font-semibold">{field.label}</span>
            <select
              value={String(value)}
              disabled={readOnly}
              onChange={(event) =>
                setContent(
                  field.path,
                  field.path === "answerIndex" ? Number(event.target.value) : event.target.value,
                )
              }
              className={selectClass}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        );
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy={titleId}
      className="max-h-[88vh] w-[min(720px,calc(100vw-32px))] max-md:h-dvh max-md:max-h-none max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0"
    >
      <div className="flex h-full max-h-[inherit] flex-col">
        <header className="flex items-center gap-1 border-b border-line py-2 pr-3 pl-1 md:px-6 md:py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the storyboard"
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[12px] border-0 bg-transparent text-ink-secondary md:hidden"
          >
            <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.75} />
          </button>
          <h2
            id={titleId}
            className="m-0 flex-1 font-display text-[17px] font-extrabold md:text-[20px]"
          >
            Scene {number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hidden size-9 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-ink-secondary hover:bg-surface-sunken md:inline-flex"
          >
            <X aria-hidden="true" size={20} strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 md:px-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] leading-5 font-semibold">Template</span>
            <select
              value={draft.template}
              disabled={readOnly}
              onChange={(event) => switchTemplate(event.target.value as TemplateName)}
              className={selectClass}
            >
              {templateNames.map((name) => (
                <option key={name} value={name}>
                  {templateLabels[name]}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Narration"
            multiline
            rows={4}
            value={draft.narration}
            maxLength={400}
            disabled={readOnly}
            error={errors.narration}
            helper="What the narrator says in this scene. Changing it changes the script too."
            lang={spec.language}
            controlClassName={cn(hindi && "font-deva")}
            onChange={(event) => apply({ ...draft, narration: event.target.value })}
          />
          {sceneForm(draft).map((group) => (
            <fieldset key={group.title} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
              <legend className="mb-3 p-0 text-[12px] font-semibold tracking-[.08em] text-ink-muted uppercase">
                {group.title}
              </legend>
              <div className="grid gap-3 md:grid-cols-2">{group.fields.map(renderField)}</div>
            </fieldset>
          ))}
        </div>

        <footer className="border-t border-line px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] md:flex md:justify-end md:px-6 md:pb-4">
          <Button onClick={onClose} className="max-md:min-h-[52px] max-md:w-full">
            Done
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
