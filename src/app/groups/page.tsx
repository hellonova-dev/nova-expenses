"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

export default function GroupsRedirect() {
  const router = useRouter();
  const { t } = useLanguage();
  useEffect(() => { router.replace("/"); }, [router]);
  return <div className="min-h-screen flex items-center justify-center text-gray-400">{t("redirecting")}</div>;
}
