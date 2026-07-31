import { MissionShareClient } from "./mission-share-client";

/**
 * Public, unauthenticated mission-share page (design `circle.*`/
 * `tracking.share` — "Primesc link web cu locația ta live... Nu au
 * nevoie de aplicație"). No login, no role guard — the token itself
 * (supabase/migrations/20260731120002_mission_share_links.sql) is the
 * entire access control, checked exclusively via
 * get_shared_mission_status(), granted to the `anon` role and nothing
 * broader.
 */
export default async function MissionSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MissionShareClient token={token} />;
}
