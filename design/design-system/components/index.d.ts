import type * as React from 'react';

export type IconName = 'play' | 'check' | 'clock' | 'alert' | 'x' | 'sparkles' | 'arrow-right' | 'arrow-up' | 'mic' | 'pencil' | 'loader' | 'film' | 'send';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one main action per view (teal). secondary: outlined. ghost: text-only teal. danger: destructive. Default primary. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** sm 32px, md 40px, lg 48px tall. Default md. */
  size?: 'sm' | 'md' | 'lg';
  /** Leading icon name. */
  icon?: IconName;
  /** Trailing icon name (e.g. arrow-right for "next"). */
  iconEnd?: IconName;
  /** Shows a spinner in place of the leading icon and sets aria-busy. Change the label to the progressive ("Generating…"). */
  loading?: boolean;
  fullWidth?: boolean;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconProps { name: IconName; size?: 16 | 20 | 24 | number; /** Give a label only when the icon stands alone and means something. */ label?: string; className?: string }
export declare function Icon(props: IconProps): React.ReactElement;

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement & HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  /** Error text; turns the border and helper danger and sets aria-invalid. */
  error?: string;
  multiline?: boolean;
  rows?: number;
}
export declare function TextField(props: TextFieldProps): React.ReactElement;

export interface SegmentedOption { value: string; label: React.ReactNode; /** 'hi' for a Devanagari label */ lang?: string }
export interface SegmentedControlProps { options: SegmentedOption[]; value?: string; defaultValue?: string; onChange?: (value: string) => void; /** Accessible name of the group, e.g. "Format". */ label: string; size?: 'sm' | 'md'; className?: string }
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { selected?: boolean; icon?: IconName }
export declare function Chip(props: ChipProps): React.ReactElement;

export interface BadgeProps { tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'highlight'; icon?: IconName; children?: React.ReactNode; className?: string }
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface ProgressBarProps { /** 0-100 */ value: number; label?: string; showValue?: boolean; className?: string }
export declare function ProgressBar(props: ProgressBarProps): React.ReactElement;

export interface ToastProps { children: React.ReactNode; tone?: 'default' | 'success' | 'danger'; actionLabel?: string; onAction?: () => void; onClose?: () => void; className?: string }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface CardProps extends React.HTMLAttributes<HTMLElement> { padding?: 'sm' | 'md' | 'lg'; interactive?: boolean; selected?: boolean; as?: keyof JSX.IntrinsicElements }
export declare function Card(props: CardProps): React.ReactElement;

export interface LogoProps { /** full: mark + wordmark. mark: the disc alone. Default full. */ variant?: 'full' | 'mark'; /** Height in px. Default 32. */ size?: number; title?: string; className?: string }
export declare function Logo(props: LogoProps): React.ReactElement;

export interface PromptComposerProps {
  label?: string; placeholder?: string; defaultValue?: string; value?: string; onChange?: React.ChangeEventHandler<HTMLTextAreaElement>; rows?: number; id?: string;
  /** Video types offered as chips. Default: Explainer, Product ad, Story, Travel, Quote, Music visual. */
  types?: string[]; type?: string; defaultType?: string; onTypeChange?: (type: string) => void;
  formats?: SegmentedOption[]; defaultFormat?: string; onFormatChange?: (format: string) => void;
  onGenerate?: () => void; loading?: boolean; submitLabel?: string; className?: string;
}
export declare function PromptComposer(props: PromptComposerProps): React.ReactElement;

export interface VideoCardProps {
  title: string; headline?: string; type?: string; duration?: string;
  status?: 'draft' | 'generating' | 'ready' | 'scheduled' | 'published' | 'failed'; statusLabel?: string; progress?: number;
  /** Video theme used for the thumbnail. */ theme?: 'midnight' | 'paper' | 'ocean' | 'sunset';
  aspect?: '9:16' | '16:9' | '1:1';
  caption?: { before?: string; word: string; after?: string };
  href?: string; className?: string;
}
export declare function VideoCard(props: VideoCardProps): React.ReactElement;

export interface SceneRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { index: number; title: string; template?: string; duration?: string; selected?: boolean; edited?: boolean; failed?: boolean }
export declare function SceneRow(props: SceneRowProps): React.ReactElement;

export interface ChatMessageProps { role?: 'user' | 'assistant'; children: React.ReactNode; className?: string }
export declare function ChatMessage(props: ChatMessageProps): React.ReactElement;

export interface ProposalCardProps {
  summary: string; scenes?: string; regeneratesVoice?: boolean; duration?: string; warnings?: string[];
  status?: 'proposed' | 'applied' | 'dismissed' | 'stale'; version?: number;
  onApply?: () => void; onDismiss?: () => void; applyLabel?: string; className?: string;
}
export declare function ProposalCard(props: ProposalCardProps): React.ReactElement;

export interface UsageMeterProps { used: number; max: number; label?: string; resetsOn?: string; className?: string }
export declare function UsageMeter(props: UsageMeterProps): React.ReactElement;

declare global {
  interface Window {
    Vidcosmos: {
      Button: typeof Button; Icon: typeof Icon; TextField: typeof TextField; SegmentedControl: typeof SegmentedControl; Chip: typeof Chip;
      Badge: typeof Badge; ProgressBar: typeof ProgressBar; Toast: typeof Toast; Card: typeof Card; Logo: typeof Logo;
      PromptComposer: typeof PromptComposer; VideoCard: typeof VideoCard; SceneRow: typeof SceneRow; ChatMessage: typeof ChatMessage;
      ProposalCard: typeof ProposalCard; UsageMeter: typeof UsageMeter;
    };
  }
}
