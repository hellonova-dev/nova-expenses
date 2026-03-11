"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

type Mode = "signin" | "signup" | "magic";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setMessage(t("check_email_magic"));
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setMessage(t("check_email_confirm"));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace("/");
    }

    setLoading(false);
  };

  if (authLoading || user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nova Expenses</h1>
        <p className="text-sm text-gray-400 mt-1">
          {mode === "signin" ? t("sign_in_to") : mode === "signup" ? t("create_account") : t("magic_link")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <input
          type="email"
          placeholder={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
          required
          autoFocus
        />

        {mode !== "magic" && (
          <input
            type="password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
            required
            minLength={6}
          />
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "..." : mode === "signin" ? t("sign_in") : mode === "signup" ? t("sign_up") : t("send_magic_link")}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500 space-y-2">
        {mode === "signin" && (
          <>
            <p>
              {t("no_account")}{" "}
              <button onClick={() => { setMode("signup"); setError(""); setMessage(""); }} className="text-violet-500 font-medium hover:underline">{t("sign_up")}</button>
            </p>
            <p>
              <button onClick={() => { setMode("magic"); setError(""); setMessage(""); }} className="text-violet-500 font-medium hover:underline">{t("use_magic_link")}</button>
            </p>
          </>
        )}
        {mode === "signup" && (
          <p>
            {t("have_account")}{" "}
            <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="text-violet-500 font-medium hover:underline">{t("sign_in")}</button>
          </p>
        )}
        {mode === "magic" && (
          <p>
            <button onClick={() => { setMode("signin"); setError(""); setMessage(""); }} className="text-violet-500 font-medium hover:underline">{t("sign_in_password")}</button>
          </p>
        )}
      </div>
    </main>
  );
}
