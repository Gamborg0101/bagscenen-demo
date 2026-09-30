import "next-auth";
import "next-auth/jwt";

// The session carries only the user id and a session version (see User.sessionVersion).
declare module "next-auth" {
  interface User {
    sv?: number;
  }
  interface Session {
    sv?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sv?: number;
  }
}
