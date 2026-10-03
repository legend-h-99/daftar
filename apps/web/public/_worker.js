// Next's static-export client can fall back to a document navigation to
// index.txt when an already-open tab sees a new deployment's build ID.
// Recover that navigation without redirecting the router's RSC fetches.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const documentRequest = request.headers.get("Sec-Fetch-Dest") === "document" ||
      request.headers.get("Accept")?.includes("text/html");
    if ((request.method === "GET" || request.method === "HEAD") &&
        documentRequest && url.pathname.endsWith("/index.txt")) {
      url.pathname = url.pathname.slice(0, -"index.txt".length);
      url.searchParams.delete("_rsc");
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.toString(),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
