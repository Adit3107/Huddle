import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import NextAuth, { type NextAuthConfig, type User } from "next-auth";
import Google from "next-auth/providers/google";

const envRoot = existsSync(resolve(process.cwd(), ".env"))
  ? process.cwd()
  : resolve(process.cwd(), "../..");

function loadRootEnv() {
  const envPath = resolve(envRoot, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    let value = trimmedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadRootEnv();

interface BackendUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

interface BackendLoginSuccess {
  success: true;
  data: {
    user: BackendUser;
    token: string;
  };
}

interface BackendLoginError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type BackendLoginResponse = BackendLoginSuccess | BackendLoginError;

type AuthUser = User & {
  backendToken?: string;
  backendUser?: BackendUser;
};

function getBackendUrl() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is required.");
  }

  return backendUrl;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required.");
  }

  return secret;
}

function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.");
  }

  return {
    clientId,
    clientSecret
  };
}

async function loginWithBackend(profile: {
  email: string;
  name: string;
  image?: string | null;
  providerId: string;
}) {
  const response = await fetch(`${getBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profile)
  });

  const payload = (await response.json()) as BackendLoginResponse;

  if (!response.ok || !payload.success) {
    const message =
      payload.success === false
        ? payload.error.message
        : "Backend authentication failed.";

    throw new Error(message);
  }

  return payload.data;
}

export const authConfig = {
  secret: getAuthSecret(),
  providers: [Google(getGoogleCredentials())],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/"
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return false;
      }

      const providerId =
        typeof profile?.sub === "string" ? profile.sub : account.providerAccountId;

      if (!user.email || !user.name || !providerId) {
        return false;
      }

      const backendSession = await loginWithBackend({
        email: user.email,
        name: user.name,
        image: user.image,
        providerId
      });

      const authUser = user as AuthUser;
      authUser.backendToken = backendSession.token;
      authUser.backendUser = backendSession.user;

      return true;
    },
    async jwt({ token, user }) {
      const authUser = user as AuthUser | undefined;

      if (authUser?.backendToken && authUser.backendUser) {
        token.backendToken = authUser.backendToken;
        token.user = authUser.backendUser;
      }

      return token;
    },
    async session({ session, token }) {
      if (typeof token.backendToken === "string") {
        session.backendToken = token.backendToken;
      }

      const backendUser = token.user as BackendUser | undefined;

      if (backendUser && session.user) {
        session.user.id = backendUser.id;
        session.user.email = backendUser.email;
        session.user.name = backendUser.name;
        session.user.image = backendUser.image;
      }

      return session;
    }
  }
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
