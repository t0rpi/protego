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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

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
