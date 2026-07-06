export interface GoogleLoginPayload {
  email?: unknown;
  name?: unknown;
  image?: unknown;
  providerId?: unknown;
}

export interface ValidGoogleLoginPayload {
  email: string;
  name: string;
  image: string | null;
  providerId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthenticatedUserResponse extends AuthenticatedUser {
  image: string | null;
}

export interface JwtPayload extends AuthenticatedUser {
  iat?: number;
  exp?: number;
}
