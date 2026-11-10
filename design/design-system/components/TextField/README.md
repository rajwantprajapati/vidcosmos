# TextField

A labelled text input or textarea. Always give it a visible `label`; placeholders are examples, not labels.

- `helper` explains format or limits ("3 to 500 characters"); `error` replaces it with what to fix ("Add at least 3 characters").
- `multiline` for prompts, notes and scripts; the user can resize it vertically.
- For Hindi content set `lang="hi"`; the browser then uses the Devanagari face.
- Validate on blur or submit, not on every keystroke.
