// @vitest-environment jsdom
// F11: JobProgress polls the job every 1.5 s with its ETag, shows each stage, stops polling
// when the job finishes, cancels, and offers "Try again" only for retryable failures.
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { JobDto } from "@vidcosmos/spec/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JobProgress, jobLabel } from "./job-progress";

const base: JobDto = {
  id: "6730a1b2c3d4e5f6a7b8c9d2",
  type: "demo",
  status: "running",
  stage: "llm",
  progress: 25,
  message: "Writing the script",
  projectId: "6730a1b2c3d4e5f6a7b8c9d1",
  scenes: null,
  result: null,
  error: null,
  cancellable: true,
  createdAt: "2026-11-12T06:00:00.000Z",
  startedAt: "2026-11-12T06:00:01.000Z",
  finishedAt: null,
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("JobProgress", () => {
  it("polls every 1.5 s with the ETag and stops once the job finishes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json(
          {
            ...base,
            stage: "narration",
            progress: 40,
            message: "Recording narration (1 of 3 scenes)",
          },
          { headers: { ETag: '"a"' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: '"a"' } }))
      .mockResolvedValueOnce(
        json({
          ...base,
          status: "succeeded",
          progress: 100,
          cancellable: false,
          finishedAt: base.createdAt,
        }),
      );
    render(<JobProgress job={base} title="How UPI works" />);
    expect(screen.getByRole("progressbar", { name: "Writing the script" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );

    await tick(1_500);
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/jobs/${base.id}`, { headers: {} });
    expect(
      screen.getByRole("progressbar", { name: "Recording narration (1 of 3 scenes)" }),
    ).toHaveAttribute("aria-valuenow", "40");

    await tick(1_500);
    expect(fetchMock).toHaveBeenLastCalledWith(`/api/v1/jobs/${base.id}`, {
      headers: { "If-None-Match": '"a"' },
    });
    await tick(1_500);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();

    await tick(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("cancels: shows Stopping… until the run stops", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...base, cancellable: false }, { status: 202 }));
    render(<JobProgress job={base} title="How UPI works" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await tick(0);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/jobs/${base.id}/cancel`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(screen.getByRole("progressbar", { name: "Stopping…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("offers Try again for a retryable failure and hands over the new job", async () => {
    const failed: JobDto = {
      ...base,
      status: "failed",
      cancellable: false,
      error: { code: "INTERNAL", message: "Something went wrong. Try again.", retryable: true },
    };
    const next = {
      ...base,
      id: "6730a1b2c3d4e5f6a7b8c9d3",
      status: "queued" as const,
      progress: 0,
    };
    fetchMock.mockResolvedValueOnce(json(next, { status: 202 }));
    const onRetry = vi.fn();
    render(<JobProgress job={failed} title="How UPI works" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await tick(0);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBeTruthy();
    expect(onRetry).toHaveBeenCalledWith(next);
  });

  it("doesn't offer Try again when the error isn't retryable", () => {
    render(
      <JobProgress
        job={{
          ...base,
          status: "failed",
          cancellable: false,
          error: { code: "CONTENT_BLOCKED", message: "This can't be made.", retryable: false },
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("labels each state in words", () => {
    expect(jobLabel({ ...base, status: "queued" })).toBe("Waiting to start");
    expect(jobLabel({ ...base, message: null })).toBe("Working");
    expect(jobLabel({ ...base, status: "cancelled", cancellable: false })).toBe(
      "Stopped during: Writing the script",
    );
    expect(jobLabel({ ...base, status: "cancelled", message: null })).toBe(
      "Stopped before it began",
    );
  });

  it("doesn't repeat the status, and colours a failed bar as danger", () => {
    render(
      <JobProgress
        title="How UPI works"
        job={{
          ...base,
          status: "failed",
          progress: 70,
          message: "Recording narration (3 of 3 scenes)",
          cancellable: false,
          error: { code: "INTERNAL", message: "Something went wrong. Try again.", retryable: true },
        }}
      />,
    );
    const card = screen.getByRole("article", { name: "How UPI works" });
    expect(card).toHaveTextContent(
      "How UPI worksFailedStopped during: Recording narration (3 of 3 scenes)70%Something went wrong. Try again.Try again",
    );
    const fill = screen.getByRole("progressbar").firstElementChild;
    expect(fill).toHaveClass("bg-danger");
  });

  it("keeps focus on the job after Cancel, and focuses a job started by Try again", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...base, cancellable: false }, { status: 202 }));
    const { unmount } = render(<JobProgress job={base} title="How UPI works" />);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    cancel.focus();
    fireEvent.click(cancel);
    await tick(0);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "How UPI works" }));
    unmount();

    render(<JobProgress job={base} title="Why the sky is blue" focusOnMount />);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Why the sky is blue" }),
    );
  });
});
