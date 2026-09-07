import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { StalePreviewReloadHint } from "@/components/StalePreviewReloadHint";
import { CookieConsent } from "@/components/CookieConsent";
import { useRouteAnalytics } from "@/lib/route-analytics";
import { I18nProvider } from "@/lib/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="text-center max-w-md">
        <div className="font-display text-7xl font-bold text-primary">404</div>
        <h1 className="mt-3 font-display text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a3a3f" },
      { title: "Makao360 — Flexible rent. Better records." },
      {
        name: "description",
        content:
          "Makao360 is the rent operating layer for urban Africa. Pay rent flexibly, track every cycle, build a verified rental history.",
      },
      { property: "og:title", content: "Makao360 — Flexible rent. Better records." },
      { name: "twitter:title", content: "Makao360 — Flexible rent. Better records." },
      { name: "description", content: "Makao360 is a platform and mobile app for managing rental properties and tenant relationships." },
      { property: "og:description", content: "Makao360 is a platform and mobile app for managing rental properties and tenant relationships." },
      { name: "twitter:description", content: "Makao360 is a platform and mobile app for managing rental properties and tenant relationships." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1bd5d512-f314-48ce-bca8-b961670d4dd9/id-preview-3be3fe6d--e54b50f7-c6a4-4a61-9fb9-f669b86a0945.lovable.app-1777327315370.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1bd5d512-f314-48ce-bca8-b961670d4dd9/id-preview-3be3fe6d--e54b50f7-c6a4-4a61-9fb9-f669b86a0945.lovable.app-1777327315370.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <GlobalErrorBoundary>
              <RouteAnalyticsBridge />
              <Outlet />
            </GlobalErrorBoundary>
            <StalePreviewReloadHint />
            <CookieConsent />
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

function RouteAnalyticsBridge() {
  useRouteAnalytics();
  return null;
}
