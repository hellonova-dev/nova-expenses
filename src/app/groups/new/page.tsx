"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import InitialsAvatar from "@/components/InitialsAvatar";

const PRESET_TYPES = [
  { emoji: "🏠", key: "group_type_household", value: "Household" },
  { emoji: "✈️", key: "group_type_trip", value: "Trip" },
  { emoji: "👫", key: "group_type_couple", value: "Couple" },
  { emoji: "🎉", key: "group_type_event", value: "Event" },
  { emoji: "🍕", key: "group_type_food", value: "Food" },
  { emoji: "💼", key: "group_type_work", value: "Work" },
];

export default function NewGroupPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [groupType, setGroupType] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  const addInvite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (email && !invitedEmails.includes(email) && email !== user?.email) {
      setInvitedEmails([...invitedEmails, email]);
      setInviteEmail("");
    }
  };

  const removeInvite = (email: string) => {
    setInvitedEmails(invitedEmails.filter((e) => e !== email));
  };

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setCreating(true);

    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        created_by: user.id,
        emoji,
        group_type: groupType || null,
      })
      .select()
      .single();

    if (groupErr) {
      console.error("Failed to create group:", groupErr);
      alert(t("error"));
      setCreating(false);
      return;
    }

    if (group) {
      await supabase.from("group_members").insert({
        group_id: group.id,
        user_id: user.id,
        email: user.email || "",
      });

      for (const email of invitedEmails) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", email)
          .single();

        if (profile) {
          await supabase.from("group_members").insert({
            group_id: group.id,
            user_id: profile.id,
            email: profile.email,
          });
        } else {
          await supabase.from("pending_invites").insert({
            group_id: group.id,
            email,
            invited_by: user.id,
          });
        }
      }

      router.push(`/groups/${group.id}`);
    } else {
      setCreating(false);
    }
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => step === 1 ? router.back() : setStep(step - 1)} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t("new_group")}</h1>
        <span className="ml-auto text-sm text-gray-400">{t("step_of", { current: step, total: 2 })}</span>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("group_name")}</label>
            <input
              type="text" placeholder="e.g. Apartment, Euro Trip 2026" value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">{t("group_emoji")}</label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_TYPES.map((tp) => (
                <button
                  key={tp.value}
                  type="button"
                  onClick={() => { setEmoji(tp.emoji); setGroupType(tp.value); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    emoji === tp.emoji && groupType === tp.value
                      ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl">{tp.emoji}</span>
                  <span className="text-sm text-gray-700">{t(tp.key)}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => name.trim() && setStep(2)}
            disabled={!name.trim()}
            className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {t("next")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{t("invite_members")}</label>
            <div className="flex gap-2">
              <input
                type="email" placeholder={t("invite_by_email")} value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-300 text-gray-800"
              />
              <button type="button" onClick={addInvite}
                className="px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-medium transition-colors">
                {t("invite")}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
              <InitialsAvatar email={user.email || ""} size="md" />
              <span className="text-sm text-gray-700 flex-1">{user.email} ({t("you").toLowerCase()})</span>
            </div>
            {invitedEmails.map((email) => (
              <div key={email} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100">
                <InitialsAvatar email={email} size="md" />
                <span className="text-sm text-gray-700 flex-1">{email}</span>
                <button onClick={() => removeInvite(email)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreate} disabled={creating}
              className="flex-1 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {creating ? t("creating") : t("create")}
            </button>
          </div>

          {invitedEmails.length === 0 && (
            <p className="text-xs text-gray-400 text-center">{t("invite_later")}</p>
          )}
        </div>
      )}
    </main>
  );
}
