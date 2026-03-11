import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/invite/resolve — resolve pending invites for a user
// Called by AuthContext on login/signup
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the user is real
  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { userId, email } = body;

  // Safety: only resolve for yourself
  if (userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminClient();

  // Upsert profile
  await admin.from("profiles").upsert({ id: userId, email }, { onConflict: "id" });

  // Find pending invites for this email
  const { data: invites } = await admin
    .from("pending_invites")
    .select("*")
    .eq("email", email);

  if (!invites || invites.length === 0) {
    return NextResponse.json({ resolved: 0 });
  }

  let resolved = 0;
  for (const invite of invites) {
    // Check if already a member (avoid duplicates)
    const { data: existing } = await admin
      .from("group_members")
      .select("id")
      .eq("group_id", invite.group_id)
      .eq("user_id", userId)
      .single();

    if (!existing) {
      await admin.from("group_members").insert({
        group_id: invite.group_id,
        user_id: userId,
        email,
      });
      resolved++;
    }

    // Delete the invite
    await admin.from("pending_invites").delete().eq("id", invite.id);
  }

  return NextResponse.json({ resolved, groups: invites.map(i => i.group_id) });
}
