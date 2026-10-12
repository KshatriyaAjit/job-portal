import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * Production Health Check Probe
 * Used by container orchestrators, load balancers, and uptime monitors.
 * Verifies application and database readiness without leaking sensitive configuration.
 */
export async function GET() {
  try {
    await connectDB();
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Health check probe failed:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

