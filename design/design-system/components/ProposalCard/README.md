# ProposalCard

The assistant's proposed change to a video: what will change, which scenes, whether new narration is needed, and the new length. Nothing changes until the user applies it.

- `summary` in one or two plain sentences, first person: "I'll cut the intro to one sentence…".
- Badges: affected scenes (`brand`), "New narration" when audio will be re-recorded (`warning`), the new length (`neutral`).
- `warnings` for consequences the user should know ("Video will be 94 s, above your 90 s target").
- After the user acts, the card stays in the chat with its outcome: applied (with the version), dismissed, or stale.
