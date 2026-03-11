"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Category } from "@/lib/types";
import { translateCategory } from "@/lib/i18n";
import InitialsAvatar from "@/components/InitialsAvatar";
import BottomNav from "@/components/BottomNav";

const EMOJI_OPTIONS = [
  "🍔", "🏠", "⚡", "🚗", "🎬", "🛍️", "💊", "✈️", "🛒", "📚",
  "🎮", "☕", "🎵", "💰", "🐾", "🎁", "💻", "📱", "🏋️", "🌮",
  "🍕", "🍣", "🍩", "🥗", "🍺", "🍷", "🏡", "🔑", "🪴", "💸",
  "💳", "🏦", "🚌", "🚲", "🛵", "🏥", "💉", "🧘", "🖥️", "📷",
  "🎧", "🎉", "🎭", "🎨", "🎪", "🌿", "🌊", "🐶", "📦", "🧹",
  "🪣", "✂️", "👶", "🎓",
];

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { t, lang, setLang, displayName, setDisplayName } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("💰");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    setLocalDisplayName(displayName || "");
  }, [displayName]);

  const [systemCategories, setSystemCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    const [userCats, defaultCats] = await Promise.all([
      supabase.from("categories").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").is("user_id", null).order("name"),
    ]);
    setCategories(userCats.data || []);
    setSystemCategories(defaultCats.data || []);
  }, [user]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const addCategory = async () => {
    if (!user || !newName.trim()) return;
    setAdding(true);
    await supabase.from("categories").insert({
      name: newName.trim(), emoji: newEmoji, user_id: user.id, is_default: false,
    });
    setNewName(""); setNewEmoji("💰"); setShowEmojiPicker(false);
    await fetchCategories();
    setAdding(false);
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("categories").delete().eq("id", id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const saveDisplayName = () => {
    setDisplayName(localDisplayName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("loading")}</div>;
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("profile")}</h1>

      {/* User info */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <InitialsAvatar email={user.email || ""} size="md" />
          <div>
            <p className="font-medium text-gray-800">{user.email}</p>
            <p className="text-xs text-gray-400">{t("member_since", { date: new Date(user.created_at).toLocaleDateString() })}</p>
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-600 mb-2">{t("display_name")}</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={localDisplayName}
            onChange={(e) => setLocalDisplayName(e.target.value)}
            placeholder={t("display_name_placeholder")}
            className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-violet-300"
            onKeyDown={(e) => e.key === "Enter" && saveDisplayName()}
          />
          <button
            onClick={saveDisplayName}
            className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors"
          >
            {nameSaved ? t("saved") : t("save")}
          </button>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-600 mb-2">{t("language")}</label>
        <div className="flex gap-2">
          <button
            onClick={() => setLang("en")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              lang === "en" ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("es")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              lang === "es" ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Español
          </button>
        </div>
      </div>

      {/* Custom Categories */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("custom_categories")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t("emoji_hint")}</p>

        {systemCategories.length > 0 && (
          <div className="space-y-2 mb-4">
            {systemCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{cat.emoji} {translateCategory(cat.name, lang)}</span>
                <span className="text-xs text-gray-400">default</span>
              </div>
            ))}
          </div>
        )}

        {categories.length === 0 && (
          <p className="text-sm text-gray-400 mb-4">{t("no_custom_categories")}</p>
        )}

        <div className="space-y-2 mb-4">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{cat.emoji} {cat.name}</span>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
              >
                {t("delete")}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg hover:bg-gray-200 transition-colors"
            >
              {newEmoji}
            </button>
            {showEmojiPicker && (
              <div className="absolute top-12 left-0 z-10 bg-white rounded-xl shadow-lg border border-gray-200 p-2 grid grid-cols-6 gap-1 w-56 max-h-48 overflow-y-auto">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setNewEmoji(e); setShowEmojiPicker(false); }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("category_name")}
            className="flex-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-violet-300"
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
          />
          <button
            onClick={addCategory}
            disabled={adding || !newName.trim()}
            className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors"
          >
            {t("add_category")}
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-semibold border border-red-200 hover:bg-red-100 transition-colors mb-8"
      >
        {t("sign_out")}
      </button>

      <p className="text-center text-xs text-gray-300">Nova Expenses v1.0 • Built with ❤️</p>

      <BottomNav />
    </main>
  );
}
