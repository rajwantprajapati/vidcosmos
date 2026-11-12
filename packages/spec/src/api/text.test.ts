import { describe, expect, it } from "vitest";
import { createProjectInput, listProjectsQuery, updateProjectInput } from "./projects.ts";
import { singleLine } from "./text.ts";
import { onboardingInput } from "./me.ts";

describe("plain text fields", () => {
  it("refuse a NUL or other control character", () => {
    expect(createProjectInput.safeParse({ topic: "abc\u0000def" }).success).toBe(false);
    expect(
      createProjectInput.safeParse({ topic: "How UPI works", notes: "a\u001Bb" }).success,
    ).toBe(false);
    expect(updateProjectInput.safeParse({ title: "A\u0007B" }).success).toBe(false);
    expect(updateProjectInput.safeParse({ script: { text: "x\u0000" } }).success).toBe(false);
    expect(
      onboardingInput.safeParse({
        persona: "creator",
        topicArea: "a\u0000",
        language: "en",
        voiceGender: "male",
      }).success,
    ).toBe(false);
    const issue = createProjectInput.safeParse({ topic: "abc\u0000def" }).error?.issues[0];
    expect(issue?.path).toEqual(["topic"]);
  });

  it("refuse C1 controls too, such as NEL (U+0085)", () => {
    expect(createProjectInput.safeParse({ topic: "abc\u0085def" }).success).toBe(false);
    expect(listProjectsQuery.parse({ q: "ab\u0085" }).q).toBe("ab");
  });

  it("allow newlines and tabs in multi-line text, but not in a title", () => {
    expect(createProjectInput.safeParse({ topic: "Line one\nLine two\twith a tab" }).success).toBe(
      true,
    );
    expect(updateProjectInput.safeParse({ title: "Line one\nLine two" }).success).toBe(false);
  });

  it("keep Hindi and emoji-free punctuation as they are", () => {
    expect(createProjectInput.parse({ topic: "UPI पेमेंट कैसे काम करता है" }).topic).toBe(
      "UPI पेमेंट कैसे काम करता है",
    );
  });
});

describe("search", () => {
  it("drops control characters instead of refusing the search", () => {
    expect(listProjectsQuery.parse({ q: "ab\u0000" }).q).toBe("ab");
    expect(listProjectsQuery.parse({ q: "a\u0000b" }).q).toBe("ab");
    expect(listProjectsQuery.safeParse({ q: "\u0000\u0000" }).success).toBe(false);
  });
});

describe("singleLine", () => {
  it("joins lines and collapses spaces", () => {
    expect(singleLine("  How UPI\nmoves\t\tmoney  ")).toBe("How UPI moves money");
  });
});
