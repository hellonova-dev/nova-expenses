"use client";

const colors = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
];

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function InitialsAvatar({ email, size = "sm" }: { email: string; size?: "sm" | "md" }) {
  const initials = email.slice(0, 2).toUpperCase();
  const color = colors[hashCode(email) % colors.length];
  const sizeClass = size === "md" ? "w-10 h-10 text-sm" : "w-7 h-7 text-xs";

  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials}
    </div>
  );
}
