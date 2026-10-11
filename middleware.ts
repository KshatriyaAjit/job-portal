import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define routes that should be PROTECTED (require login)
const isProtectedRoute = createRouteMatcher([
  '/post-job(.*)', // Protect the post-job page
  '/dashboard(.*)', // Protect dashboard
]);

// ⚠️ NOTICE: We added 'async' here
export default clerkMiddleware(async (auth, req) => {
  // ⚠️ NOTICE: We added 'await' here because auth() is now a Promise
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};