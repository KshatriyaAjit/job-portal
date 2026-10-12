import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import User, { UserRole } from "@/models/User";
import Profile from "@/models/Profile";
import SavedJob from "@/models/SavedJob";
import Application from "@/models/Application";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET in environment variables.");
    return NextResponse.json(
      { error: "Webhook secret is unconfigured." },
      { status: 500 }
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- missing svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred -- invalid webhook signature", {
      status: 400,
    });
  }

  // Handle the event
  const eventType = evt.type;

  // 1. Handle User Creation (Idempotent Upsert)
  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name, public_metadata } = evt.data;
    
    await connectDB();
    
    const email = email_addresses?.[0]?.email_address || "";
    // Client-controlled unsafe_metadata is NEVER trusted to grant recruiter or admin privileges.
    // Only server-controlled public_metadata can assign the recruiter role; otherwise defaults to candidate.
    const role: UserRole =
      public_metadata?.role === "recruiter" ? "recruiter" : "candidate";

    // Idempotent upsert prevents race conditions or duplicate deliveries from throwing duplicate key errors
    try {
      await User.findOneAndUpdate(
        { clerkId: id },
        {
          $setOnInsert: {
            clerkId: id,
            email,
            firstName: first_name ?? undefined,
            lastName: last_name ?? undefined,
            role,
            recruiterStatus: role === "recruiter" ? "approved" : "none",
          },
        },
        { upsert: true, new: true }
      );
      console.log(`User synced in MongoDB: ${id} with role: ${role}`);
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; message?: string };
      if (mongoErr?.code === 11000 || mongoErr?.message?.includes("E11000")) {
        console.log(`User ${id} already synced in MongoDB concurrently.`);
      } else {
        throw err;
      }
    }
  }

  // 2. Handle User Updates
  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, public_metadata } = evt.data;
    
    await connectDB();
    
    const email = email_addresses?.[0]?.email_address;
    const updatePayload: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      recruiterStatus?: "approved" | "none" | "pending" | "rejected";
    } = {};
    if (email) updatePayload.email = email;
    if (first_name !== undefined) updatePayload.firstName = first_name ?? undefined;
    if (last_name !== undefined) updatePayload.lastName = last_name ?? undefined;

    // Only update role if explicitly defined in server-controlled public_metadata.
    // Client-controlled unsafe_metadata is strictly ignored to prevent privilege escalation.
    if (public_metadata?.role === "recruiter") {
      updatePayload.role = "recruiter";
      updatePayload.recruiterStatus = "approved";
    } else if (public_metadata?.role === "candidate") {
      updatePayload.role = "candidate";
    }

    await User.findOneAndUpdate({ clerkId: id }, updatePayload);
    console.log(`User updated in MongoDB: ${id}`);
  }

  // 3. Handle User Deletion (Cascading Cleanup)
  if (eventType === "user.deleted") {
    const { id } = evt.data;
    
    if (id) {
      await connectDB();
      
      await User.findOneAndDelete({ clerkId: id });
      await Profile.findOneAndDelete({ userId: id });
      await SavedJob.deleteMany({ userId: id });
      await Application.deleteMany({ userId: id });
      console.log(`User and associated profile, saved jobs, and applications deleted from MongoDB: ${id}`);
    }
  }

  return NextResponse.json({ message: "Webhook received", success: true });
}