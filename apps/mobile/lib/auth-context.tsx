import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@protego/supabase";
import { supabase } from "./supabase";
import { registerForPushNotifications } from "./push";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let settled = false;
    // getSession() reads the stored session locally, but if the stored
    // access token is expired it triggers a background refresh network
    // call first — one that can hang indefinitely (never resolving OR
    // rejecting) if the device has no route to Supabase's cloud API
    // (e.g. LAN-only connectivity to the dev machine, no real internet).
    // A plain .then(onFulfilled, onRejected) doesn't help a hang that
    // never settles either way, so this also races against a timeout:
    // every screen in the app gates its first real render on `loading`,
    // so this one call, unresolved, can produce an app-wide permanent
    // loading-spinner hang.
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setSession(null);
      setLoading(false);
    }, 8000);

    supabase.auth
      .getSession()
      .then(
        ({ data }) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          setSession(data.session);
          setLoading(false);
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          setSession(null);
          setLoading(false);
        }
      );

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Register once per new session — registerForPushNotifications()
    // itself is best-effort (see that file), so a failure here never
    // needs surfacing to the user.
    if (session) {
      registerForPushNotifications(session.user.id);
    }
  }, [session]);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
