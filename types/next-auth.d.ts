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
      /** Account deleted since sign-in. */
      revoked?: boolean;
    };
  }
  interface User {
    id: string;
    role: Role;
    assignedTrackId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: Role;
    assignedTrackId?: string | null;
    /** ms timestamp of the last DB re-check of this account. */
    checkedAt?: number;
    /** Account deleted since sign-in: middleware and guards reject the token. */
    revoked?: boolean;
  }
}
