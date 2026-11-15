// Ideas (API §6): ask for angles on the project's topic. The job's result is the angle ids;
// the angles themselves are on the project (`idea.angles`).
import { z } from "zod";
import { controlCharacterMessage, isPlainText } from "./text.ts";

/** How many angles to ask for: 3 to 5, 4 by default (API §6, decision log 14 Nov). */
export const angleCounts = [3, 4, 5] as const;
export const defaultAngleCount = 4;

export const requestIdeasInput = z.object({
  count: z.union([z.literal(3), z.literal(4), z.literal(5)]).default(defaultAngleCount),
  /** e.g. "focus on exam questions". */
  steer: z.string().trim().max(200).refine(isPlainText(false), controlCharacterMessage).optional(),
});
export type RequestIdeasInput = z.infer<typeof requestIdeasInput>;
