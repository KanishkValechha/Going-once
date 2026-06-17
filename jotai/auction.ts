import { atom } from 'jotai';

/** Text value of the manual bid-override input in the auction console. */
export const overrideBidAtom = atom<string>('');

/** Which destructive action is awaiting confirmation in the console, if any. */
export type PendingAction = 'sold' | 'unsold' | null;
export const pendingActionAtom = atom<PendingAction>(null);
