import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// DELETE /api/members — remove a member from a group (admin only)
export async function DELETE(request: Request) {
  const body = await request.json();
  const { userId, groupId } = body;

  if (!userId || !groupId) {
    return NextResponse.json({ error: "userId and groupId required" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Get requester
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify requester is the group admin (creator)
  const { data: group } = await admin
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .single();

  if (!group || group.created_by !== user.id) {
    return NextResponse.json({ error: "Only the group admin can remove members" }, { status: 403 });
  }

  // Can't remove yourself (the admin)
  if (userId === user.id) {
    return NextResponse.json({ error: "You can't remove yourself from the group" }, { status: 400 });
  }

  // Remove from group_members
  const { error } = await admin
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "removed", message: "Member removed" });
}
