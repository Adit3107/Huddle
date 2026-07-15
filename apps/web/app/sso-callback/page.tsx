import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/dashboard"
      signInForceRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      signUpUrl="/sign-up"
    />
  );
}
