import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/invite?groupId=xxx — list pending invites for a group
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");

  if (!groupId) {
    return NextResponse.json({ error: "groupId required" }, { status: 400 });
  }

  const admin = getAdminClient();

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

  // Verify requester is a group member
  const { data: membership } = await admin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  const { data: invites } = await admin
    .from("pending_invites")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ invites: invites || [] });
}

// POST /api/invite — invite a user to a group
// ALL invites go through pending_invites first. The invited user must accept.
export async function POST(request: Request) {
  const body = await request.json();
  const { email, groupId, invitedByEmail } = body;

  if (!email || !groupId || !invitedByEmail) {
    return NextResponse.json({ error: "email, groupId, and invitedByEmail required" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Verify inviter is a group member
  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", invitedByEmail)
    .single();

  if (!inviterProfile) {
    return NextResponse.json({ error: "Inviter not found" }, { status: 403 });
  }

  const { data: inviterMembership } = await admin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", inviterProfile.id)
    .single();

  if (!inviterMembership) {
    return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
  }

  // Check if already a member
  const { data: existingMember } = await admin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("email", email);

  if (existingMember && existingMember.length > 0) {
    return NextResponse.json({ status: "already_member", message: "Already a member" });
  }

  // Check if already invited
  const { data: existingInvite } = await admin
    .from("pending_invites")
    .select("id")
    .eq("group_id", groupId)
    .eq("email", email);

  if (existingInvite && existingInvite.length > 0) {
    // Resend email
    await sendInviteEmail(admin, email, groupId, request);
    return NextResponse.json({ status: "resent", message: "Invite resent" });
  }

  // Insert pending invite
  const { error: inviteError } = await admin
    .from("pending_invites")
    .insert({ group_id: groupId, email, invited_by: inviterProfile.id });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  // Get group name for the email
  const { data: group } = await admin
    .from("groups")
    .select("name, emoji")
    .eq("id", groupId)
    .single();

  const groupName = group ? `${group.emoji} ${group.name}` : "a group";

  // Check if user already has an account
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (profile) {
    // Existing user — send them a notification email via Supabase magic link
    // When they click, they log in and AuthContext resolves the invite
    const siteUrl = getSiteUrl(request);
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm` },
    });
    // Also send via signInWithOtp to actually deliver the email
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await anonClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
    });
    return NextResponse.json({ status: "invited", message: `Invite sent to existing user` });
  } else {
    // New user — create account + send invite email
    await sendInviteEmail(admin, email, groupId, request);
    return NextResponse.json({ status: "invited", message: "Invite sent" });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendInviteEmail(
  admin: any,
  email: string,
  groupId: string,
  request: Request
) {
  const siteUrl = getSiteUrl(request);
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  });
  if (error) {
    // User might already exist in auth but not in profiles — try magic link instead
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await anonClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/confirm` },
    });
  }
}

function getSiteUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

// DELETE /api/invite — cancel a pending invite
export async function DELETE(request: Request) {
  const body = await request.json();
  const { email, groupId } = body;

  if (!email || !groupId) {
    return NextResponse.json({ error: "email and groupId required" }, { status: 400 });
  }

  const admin = getAdminClient();

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

  // Verify requester is a group member
  const { data: membership } = await admin
    .from("group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
  }

  await admin
    .from("pending_invites")
    .delete()
    .eq("group_id", groupId)
    .eq("email", email);

  return NextResponse.json({ status: "cancelled", message: "Invite cancelled" });
}
