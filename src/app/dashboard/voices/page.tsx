import { VoiceManager } from "@/components/voices/voice-manager";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VoicesPage() {
  const user = await requireUser();
  return <VoiceManager storageMode={user.storage_mode} />;
}
