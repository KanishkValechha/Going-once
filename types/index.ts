import { Doc, Id } from '@/convex/_generated/dataModel';

export type Tournament = Doc<'tournaments'>;
export type Team = Doc<'teams'>;
export type Player = Doc<'players'>;
export type User = Doc<'users'>;

export type UserRole = 'admin' | 'member';
export type TournamentStatus = 'draft' | 'live' | 'completed';
export type PlayerStatus = 'available' | 'sold' | 'unsold';
export type AuctionPhase = 'idle' | 'bidding';

/** Team enriched with a resolved logo URL (as returned by team/auction queries). */
export type TeamWithLogo = Team & { logoUrl: string | null };
/** Player enriched with a resolved image URL. */
export type PlayerWithImage = Player & { imageUrl: string | null };
/** Team in the console with its computed max affordable bid. */
export type ConsoleTeam = Team & { maxBid: number };

export type { Id };
