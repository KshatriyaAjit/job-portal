
import dns from "node:dns";
import mongoose from "mongoose";

// Configure dedicated public DNS resolver fallback for MongoDB Atlas SRV/TXT resolution
// This resolves the Windows 11 / Node.js c-ares local DNS proxy ECONNREFUSED issue on port 53.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  const customPromisesResolver = new dns.promises.Resolver();
  customPromisesResolver.setServers(["8.8.8.8", "1.1.1.1"]);
  dns.promises.resolveSrv = customPromisesResolver.resolveSrv.bind(customPromisesResolver);
  dns.promises.resolveTxt = customPromisesResolver.resolveTxt.bind(customPromisesResolver);

  const customCbResolver = new dns.Resolver();
  customCbResolver.setServers(["8.8.8.8", "1.1.1.1"]);
  dns.resolveSrv = customCbResolver.resolveSrv.bind(customCbResolver);
  dns.resolveTxt = customCbResolver.resolveTxt.bind(customCbResolver);
} catch {
  // Fallback cleanly in environments where overriding DNS servers is restricted
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached = global.mongoose ?? {
  conn: null,
  promise: null,
};

global.mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Please define MONGODB_URI in your .env.local file."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((instance) => {
        console.log("MongoDB connected successfully.");
        return instance;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
