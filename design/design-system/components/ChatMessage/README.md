# ChatMessage

A bubble in the revision chat. The user's messages sit right on `surface-inverse`; the assistant's sit left on `surface-sunken`.

- Put the chat in a column with `display: flex; flex-direction: column; gap: 8px` so bubbles align.
- Assistant replies that propose a change use `ProposalCard` instead of plain text.
- Keep messages to `body` size; no avatars needed.
