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

## Translations

Every text on screen goes through i18next. Add each key to both `src/Locales/pt/translation.json` and `src/Locales/en/translation.json`; the two files keep the same keys. The default language is European Portuguese.

## Theme

Colours come only from CSS tokens (`var(--…)`) defined in `src/Styles/Theme/`, with a light and a dark theme (`data-theme` on `<html>`). Components never use hex values. A new token is named after its component, for example `--portfolio-chart-total`.

## Charts

Charts use [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle), installed from its git tag (`openchartscandle` in `package.json`). Import the family you need (`openchartscandle/line`, `/bar`, `/heatmap`, `/candlestick`…) and pass colours resolved from the theme tokens (`Components/Charts/resolveColor.ts`), so the charts follow the theme.

## Company screens

`Company_Context` holds the user's permissions in the current company (`can(...)`). Areas and sections of the side panel declare the permissions they need, buttons hide when the user lacks them, and record pages become read-only.
