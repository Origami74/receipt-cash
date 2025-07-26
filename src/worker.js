export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle assets and API routes - serve them directly
    if (
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/api/') ||
      pathname.includes('.') && !pathname.endsWith('/') // Files with extensions (except trailing slash)
    ) {
      return env.ASSETS.fetch(request);
    }

    // For all other routes (SPA routes), serve index.html
    try {
      // Try to get the index.html from assets
      const indexRequest = new Request(new URL('/index.html', request.url), {
        method: 'GET',
        headers: request.headers,
      });
      
      const response = await env.ASSETS.fetch(indexRequest);
      
      // Return the index.html with appropriate headers for SPA
      return new Response(response.body, {
        status: 200,
        headers: {
          ...response.headers,
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (error) {
      // Fallback to assets if something goes wrong
      return env.ASSETS.fetch(request);
    }
  },
};