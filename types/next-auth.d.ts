import "next-auth";
import "next-auth/jwt";

type Role = "ADMIN" | "SCANNER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      assignedTrackId?: string | null;
      /** Account deleted, or its password changed, since sign-in. */
      revoked?: boolean;
    };
  }
  interface User {
    id: string;
    role: Role;
    assignedTrackId?: string | null;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: Role;
    assignedTrackId?: string | null;
    /** ms timestamp of the last DB re-check of this account. */
    checkedAt?: number;
    /** Admin.sessionVersion at sign-in; a password change bumps it. Missing = 0. */
    sessionVersion?: number;
    /** Account deleted (or password changed) since sign-in: middleware and guards reject the token. */
    revoked?: boolean;
  }
}
