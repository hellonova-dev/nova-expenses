"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { t as translate } from "@/lib/i18n";

type LanguageContextType = {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  displayName: string | null;
  setDisplayName: (name: string) => void;
};

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  displayName: null,
  setDisplayName: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState("en");
  const [displayName, setDisplayNameState] = useState<string | null>(null);

  // Fetch profile on user change
  useEffect(() => {
    if (!user) {
      setLangState("en");
      setDisplayNameState(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("language, display_name")
        .eq("id", user.id)
        .single();
      if (data) {
        setLangState(data.language || "en");
        setDisplayNameState(data.display_name || null);
      }
    })();
  }, [user]);

  const setLang = useCallback(async (newLang: string) => {
    setLangState(newLang);
    if (user) {
      await supabase.from("profiles").update({ language: newLang }).eq("id", user.id);
    }
  }, [user]);

  const setDisplayName = useCallback(async (name: string) => {
    setDisplayNameState(name || null);
    if (user) {
      await supabase.from("profiles").update({ display_name: name || null }).eq("id", user.id);
    }
  }, [user]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return translate(key, lang, params);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, displayName, setDisplayName }}>
      {children}
    </LanguageContext.Provider>
  );
}
