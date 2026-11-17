# OyoPasal Coding Standards

## 1. Layering & Dependency Rules
1. **No direct `fetch()` inside UI components or pages.** All API calls must route through `src/services/*` using `httpClient`.
2. **No circular imports between contexts.** Lower-level providers (`Toast`, `Theme`, `Language`) must never depend on domain providers (`Auth`, `Seller`, `Cart`).
3. **Hooks own orchestration; components own rendering.** Pages and modals should delegate data fetching, error states, and multi-step flows to hooks in `src/hooks/`.
4. **Domain-scoped TypeScript types.** Add interfaces to the matching module under `src/types/` and re-export from `src/types/index.ts`. Avoid `any` in new/refactored service and hook signatures.

## 2. UI, Styling & Accessibility
1. **Tailwind CSS v4 + CSS tokens**: Design tokens live in `src/styles/variables.css` and theme overrides in `src/styles/themes.css`, imported once via `src/styles/globals.css`.
2. **Shared feedback components**: Use `ErrorAlert` for recoverable data errors, `EmptyState` for empty lists, `SkeletonCard` for loading grids, and `ConfirmDialog` instead of browser `window.confirm`.
3. **Interactive controls**: Always specify explicit `type="button"` on non-submit buttons and include `aria-label` on icon-only controls.
4. **Bilingual support**: Never hardcode user-facing copy where `t(...)` or language-aware helpers (`translateCategoryName`, `translateOrderStatus`, `translateDurationText`) exist.

## 3. File Naming Conventions
- Components & Pages: `PascalCase.tsx` (e.g., `ProductCard.tsx`, `CheckoutPage.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useHomeData.ts`)
- Services, Utils, Types, Config: `camelCase.ts` (e.g., `httpClient.ts`, `priceFormatter.ts`)
- Directories: `lowercase` feature/domain folders (`common/`, `modals/`, `checkout/`)

## 4. Verification Gate
Before completing any frontend change:
1. Run `npm run lint` (`tsc --noEmit`) with 0 errors.
2. Run `npm run build` (`vite build`) cleanly.
3. Verify zero stale relative paths or unused placeholder files remain.
