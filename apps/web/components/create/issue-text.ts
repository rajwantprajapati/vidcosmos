// What a banner says about a spec issue (the storyboard step, the editor), naming the element
// and its words, and the issues grouped by scene.
import { type Scene, sceneElements, type SpecIssue } from "@vidcosmos/spec/video";

export function issueText(issue: SpecIssue, scene: Scene | undefined): string {
  if (issue.code === "TRIGGER_NOT_IN_NARRATION" && scene && issue.path) {
    const element = sceneElements(scene).find((e) => e.path === issue.path);
    if (element) {
      return `“${element.label}” waits for the words “${element.trigger}”, but the narrator never says them. Change the words it appears on, or edit the narration.`;
    }
  }
  return issue.message;
}

/** Each scene's issues; issues with the whole video are left out. */
export function issuesByScene(issues: SpecIssue[]): Map<string, SpecIssue[]> {
  const map = new Map<string, SpecIssue[]>();
  for (const issue of issues) {
    if (!issue.sceneId) continue;
    map.set(issue.sceneId, [...(map.get(issue.sceneId) ?? []), issue]);
  }
  return map;
}
