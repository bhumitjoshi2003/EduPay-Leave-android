import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Public static pages — safe to prerender (no auth, no user-specific data).
  { path: 'home',           renderMode: RenderMode.Prerender },
  { path: 'reset-password', renderMode: RenderMode.Prerender },

  // All authenticated dashboard routes must render on the client.
  // Server-rendering them would produce a blank/wrong shell because they
  // require a valid JWT in localStorage and user-specific API data.
  { path: 'dashboard/**',   renderMode: RenderMode.Client },

  // Catch-all fallback.
  { path: '**',             renderMode: RenderMode.Client }
];
