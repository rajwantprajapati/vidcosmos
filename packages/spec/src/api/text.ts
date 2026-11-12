// Text people type: titles, topics, notes, scripts. Control characters (a NUL, an escape) have
// no place in them: MongoDB can't search for a NUL, and they show as "�". Tab, newline and
// carriage return are allowed in multi-line text.

/* eslint-disable no-control-regex -- finding control characters is this file's purpose */

/** Every control character (C0, DEL and C1) except tab, newline and carriage return. */
const controlInMultiline = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
/** Every control character, newlines included. */
const controlInLine = /[\u0000-\u001F\u007F-\u009F]/;
const controlEverywhere = /[\u0000-\u001F\u007F-\u009F]/g;

export const controlCharacterMessage =
  "Remove the control characters (such as a NUL) from this text.";

/** For `.refine()`: true when the text has no control characters it shouldn't. */
export const isPlainText = (multiline: boolean) => (value: string) =>
  !(multiline ? controlInMultiline : controlInLine).test(value);

/** Drops every control character, for input that is cleaned rather than refused (search). */
export const stripControlCharacters = (value: string) => value.replace(controlEverywhere, "");

/** One line of text from text that may span several: runs of whitespace become one space. */
export const singleLine = (value: string) => value.replace(/\s+/g, " ").trim();
