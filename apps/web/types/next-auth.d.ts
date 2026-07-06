import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    backendToken?: string;
    user: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    backendToken?: string;
    backendUser?: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendToken?: string;
    user?: {
      id: string;
      email: string;
      name: string;
      image: string | null;
    };
  }
}
