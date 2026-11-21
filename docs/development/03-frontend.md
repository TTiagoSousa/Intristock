# 3. Frontend

`apps/frontend` is React 19 with Vite and SCSS.

## Layout

```
src/Pages/        one folder per screen (Private/Companies, Private/Finances, Private/Trading…)
src/Components/   shared pieces (buttons, popovers, cards, charts)
src/Containers/   the shell: rail, side panel (Navs/Navigation_Home/Menu_Itins.ts), header
src/Hooks/        data hooks per area
src/Contexts/     session, company, currency, theme
src/Locales/      pt and en translations
src/Styles/Theme/ the CSS tokens
```

Each area's pages are re-exported from one file in `src/Imports/Areas/` and loaded with `React.lazy`, so the login does not download the simulator. Routing uses `react-router` only.

## Shared building blocks

- `Components/Popover_Shell`: every popover (dialog role, focus trap and return, Esc closes only the top one, no closing while saving). `Components/Confirm_Popover` for confirmations.
- `Authentication/Company_Permission_Gate`: company routes check the permission the menu area or section needs and show a `Page_Notice` instead of the backend error.
- `utils/dates`: `localToday()`, `localMonth()` for default dates (never `toISOString().slice(0, 10)`, which is a UTC day). `utils/locale`: `localeOf(language)` for `Intl` and `toLocale*String`.
- `Service/httpService.ts` sends `X-Requested-With` on every request and sends a 401 to `/Auth?next=<path>`; the login goes back there.
- `Hooks/useVisibleInterval`: polling that pauses while the tab is hidden.

## Translations

Every text on screen goes through i18next. Add each key to both `src/Locales/pt/translation.json` and `src/Locales/en/translation.json`; the two files keep the same keys. The default language is European Portuguese. Only the active language's file is loaded (`src/i18n/i18n.ts`), plus Portuguese as the fallback.

## Theme

Colours come only from CSS tokens (`var(--…)`) defined in `src/Styles/Theme/`, with a light and a dark theme (`data-theme` on `<html>`). Components never use hex values. A new token is named after its component, for example `--portfolio-chart-total`.

## Charts

Charts use only [OpenChartsCandle] (no recharts)(https://github.com/TTiagoSousa/OpenChartsCandle), installed from its git tag (`openchartscandle` in `package.json`). Import the family you need (`openchartscandle/line`, `/bar`, `/heatmap`, `/candlestick`…) and pass colours resolved from the theme tokens (`Components/Charts/resolveColor.ts`), so the charts follow the theme.

## Company screens

`Company_Context` holds the user's permissions in the current company (`can(...)`). Areas and sections of the side panel declare the permissions they need, buttons hide when the user lacks them, and record pages become read-only.
