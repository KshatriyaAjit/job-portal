import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env.local");
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
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
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Handle the event
  const eventType = evt.type;

  // 1. Handle User Creation
  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name, unsafe_metadata } = evt.data;
    
    await connectDB();
    
    // Create user in MongoDB
    // We check if user exists just in case to prevent duplicate errors
    const userExists = await User.findOne({ clerkId: id });
    
    if (!userExists) {
        await User.create({
            clerkId: id,
            email: email_addresses[0].email_address,
            firstName: first_name,
            lastName: last_name,
            role: unsafe_metadata?.role || "candidate", 
        });
        console.log(`User created in MongoDB: ${id}`);
    }
  }

  // 2. Handle User Updates
  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, unsafe_metadata } = evt.data;
    
    await connectDB();
    
    await User.findOneAndUpdate(
        { clerkId: id },
        {
            email: email_addresses[0].email_address,
            firstName: first_name,
            lastName: last_name,
            role: unsafe_metadata?.role,
        }
    );
    console.log(`User updated in MongoDB: ${id}`);
  }

  // 3. Handle User Deletion
  if (eventType === "user.deleted") {
    const { id } = evt.data;
    
    await connectDB();
    
    await User.findOneAndDelete({ clerkId: id });
    console.log(`User deleted from MongoDB: ${id}`);
  }

  return NextResponse.json({ message: "Webhook received", success: true });
}