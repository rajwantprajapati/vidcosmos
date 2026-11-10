# Button

Use a button for an action; use a link for navigation. **Primary** (teal fill, ink label) at most once per view, for the thing the screen is for: "Generate video", "Apply", "Export". **Secondary** (outlined) for the other actions, **ghost** for low-emphasis actions inside cards and toolbars, **danger** only to confirm a destructive step inside a dialog.

- Label: a verb in sentence case that says what happens ("Post to Instagram", not "Submit"). While working, switch to the progressive and set `loading` ("Generating…").
- Sizes: `md` (40 px) in the app, `lg` (48 px) in marketing heroes, `sm` (32 px) inside dense rows and chat proposals.
- Icons: `icon` before the label for actions with a strong symbol (`sparkles` for AI generation), `iconEnd="arrow-right"` for "next step".
- Disabled buttons explain why nearby. Prefer leaving the button enabled and showing what is missing when clicked.
- Never put white text on teal, never make two primary buttons side by side.
