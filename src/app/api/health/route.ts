// Liveness check for Docker, uptime monitors and deploy verification.
export function GET() {
  return Response.json({
    status: "ok",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  });
}
