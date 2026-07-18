import type { IdeAtMention, IdeSelection } from '../entities/ideSelection.js';

export interface IIdeContextSink {
  publishSelection(serverId: string, selection: IdeSelection): void;
  publishAtMention(serverId: string, mention: IdeAtMention): void;
  clear(serverId: string): void;
}
