import createIntlMiddleware from "next-intl/middleware";
import {
  convexAuthNextjsMiddleware,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

// Only route that doesn't require a signed-in user. Everything else under
// /:locale/* is gated -- see @convex-dev/auth's own JSDoc example for this
// exact composition pattern (convexAuthNextjsMiddleware wrapping a custom
// handler that reads ctx.convexAuth).
function isLoginPath(pathname: string): boolean {
  return routing.locales.some(
    (locale) => pathname === `/${locale}/login` || pathname === `/${locale}/login/`,
  );
}

function localeFromPath(pathname: string): string {
  const segment = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(segment)
    ? segment
    : routing.defaultLocale;
}

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const { pathname } = request.nextUrl;
  const locale = localeFromPath(pathname);
  const authenticated = await convexAuth.isAuthenticated();

  if (!isLoginPath(pathname) && !authenticated) {
    return nextjsMiddlewareRedirect(request, `/${locale}/login`);
  }
  if (isLoginPath(pathname) && authenticated) {
    return nextjsMiddlewareRedirect(request, `/${locale}`);
  }
  return handleI18nRouting(request);
});

export const config = {
  // Skip static files and Next internals; run on everything else, including
  // the bare "/" so next-intl can redirect it to the default locale.
  matcher: ["/((?!_next|.*\\..*).*)"],
};
