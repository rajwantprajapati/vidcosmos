// F15: word count, estimated length and fit, in English and Hindi; the hook; the requests.
import { describe, expect, it } from "vitest";
import {
  countWords,
  firstSentence,
  rewriteScriptInput,
  scriptFit,
  scriptStats,
  targetWords,
} from "./script.ts";

describe("word count", () => {
  it("counts English words, not dashes or stray punctuation", () => {
    expect(countWords("You tap Pay, and in about two seconds your friend has the money.")).toBe(13);
    expect(countWords("UPI — fast, simple . Done")).toBe(4);
    expect(countWords("  \n\n ")).toBe(0);
    expect(countWords("It's 2 o'clock")).toBe(3);
  });

  it("counts Hindi words, and a danda with a space before it isn't one", () => {
    expect(countWords("यूपीआई से पैसा दो सेकंड में पहुँचता है।")).toBe(8);
    expect(countWords("यूपीआई से पैसा दो सेकंड में पहुँचता है ।")).toBe(8);
    // Hinglish counts the same way.
    expect(countWords("आपका UPI PIN सुरक्षित है।")).toBe(5);
  });
});

describe("estimated length", () => {
  it("uses 2.5 words a second in English and 2.2 in Hindi (DB §5)", () => {
    const english = Array.from({ length: 139 }, () => "word").join(" ");
    expect(scriptStats(english, "en")).toEqual({ wordCount: 139, estDurationSec: 55.6 });
    const hindi = Array.from({ length: 132 }, () => "शब्द").join(" ");
    expect(scriptStats(hindi, "hi")).toEqual({ wordCount: 132, estDurationSec: 60 });
  });

  it("sizes the target to the length (PRD FR-2.1: 75/150/225 words in English)", () => {
    expect([30, 60, 90].map((s) => targetWords(s, "en"))).toEqual([75, 150, 225]);
    expect([30, 60, 90].map((s) => targetWords(s, "hi"))).toEqual([66, 132, 198]);
  });

  it("fits within 15% of the target either way (PRD FR-2.4)", () => {
    expect(scriptFit(56, 60)).toBe("fits");
    expect(scriptFit(69, 60)).toBe("fits");
    expect(scriptFit(69.1, 60)).toBe("over");
    expect(scriptFit(51, 60)).toBe("fits");
    expect(scriptFit(50.9, 60)).toBe("under");
  });
});

describe("the hook", () => {
  it("is the first sentence, in either language", () => {
    expect(firstSentence("You tap Pay. Two seconds later, it's there.")).toBe("You tap Pay.");
    expect(firstSentence("Where does it go? Let's see.")).toBe("Where does it go?");
    expect(firstSentence("“Pending” isn’t failed.” Then more.")).toBe("“Pending” isn’t failed.”");
    expect(firstSentence("पैसा कहाँ जाता है। चलिए देखते हैं।")).toBe("पैसा कहाँ जाता है।");
    expect(firstSentence("No full stop at all")).toBe("No full stop at all");
    expect(firstSentence("Version 2.5 is out. Next")).toBe("Version 2.5 is out.");
  });
});

describe("rewrite request", () => {
  it("needs words for a custom rewrite and a non-empty selection", () => {
    expect(rewriteScriptInput.safeParse({ instruction: "custom" }).success).toBe(false);
    expect(rewriteScriptInput.safeParse({ instruction: "custom", custom: "  " }).success).toBe(
      false,
    );
    expect(
      rewriteScriptInput.safeParse({ instruction: "custom", custom: "Use a cricket example" })
        .success,
    ).toBe(true);
    expect(
      rewriteScriptInput.safeParse({ instruction: "shorter", selection: { start: 4, end: 4 } })
        .success,
    ).toBe(false);
    expect(rewriteScriptInput.safeParse({ instruction: "louder" }).success).toBe(false);
  });
});
