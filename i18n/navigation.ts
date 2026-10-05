import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link/router: the EN/SQ toggle uses `useRouter().replace(...)`
// to swap locale while preserving the current path and query string.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
