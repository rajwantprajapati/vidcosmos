# PromptComposer

Where every video starts: a prompt box, the video type as chips, the format, and the generate button. Used in the marketing hero and at the top of the library.

- The label is "Describe your video"; the placeholder is a real example the user could send.
- The default type list covers what Vidcosmos makes: Explainer, Product ad, Story, Travel, Quote, Music visual. Pass `types` to narrow it.
- `onGenerate` fires on submit; set `loading` while the request is in flight.
- On marketing pages, a signed-out submit keeps the prompt and asks the visitor to sign in, then continues.
