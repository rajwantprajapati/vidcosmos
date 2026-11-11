// Rules shared by the auth server config and the forms.
export const passwordRules = { min: 10, max: 128 } as const;

export const deletingAccountMessage =
  "This account is being deleted, so you can't sign in. Contact support if this is a mistake.";
