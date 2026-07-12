import { ChatClient } from "@/components/chat/chat-client";
import { getCurrentSession } from "@/lib/auth";
import { getBackendUrl } from "@/lib/rooms";

interface ChatPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const session = await getCurrentSession();

  return (
    <ChatClient
      backendToken={session?.backendToken ?? null}
      backendUrl={getBackendUrl()}
      roomId={id}
      user={
        session?.user
          ? {
              id: session.user.id,
              name: session.user.name ?? "HUDDLE User",
              email: session.user.email ?? "",
              image: session.user.image ?? null
            }
          : null
      }
    />
  );
}
