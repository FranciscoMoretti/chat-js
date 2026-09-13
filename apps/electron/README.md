# Electron Desktop App

This directory contains the Electron wrapper for your ChatJS app.

## Development

Make sure the Next.js web app is running first (`bun run dev` in the parent directory), then:

```bash
bun install
bun run dev
```

`bun run dev` points Electron at `http://localhost:3000` by default. You can override that during development with `ELECTRON_APP_URL=... bun run dev`.

## Customization

### App Icon

Replace `icon.png` with your own 512×512 PNG. Then regenerate the platform icons:

```bash
bun run generate-icons
```

This produces the generated assets in `build/` used by Electron Forge.

### App Name & ID

The app name, protocol prefix, and production URL are generated from your ChatJS config before each build. Use `forge.config.ts` only for packaging-specific overrides:

- `appName` controls the display name shown in the OS
- `appPrefix` controls the bundle identifier prefix and protocol scheme

### Protocol Scheme (Deep Links)

The `APP_SCHEME` in `src/config.ts` controls the custom URL scheme used for OAuth deep links (e.g. `yourapp://`). It must match the `protocols` entries in `forge.config.ts`.

### Production URL

Update `appUrl` in `apps/chat/chat.config.ts` for your deployed site. Packaged Electron builds use that URL by default, while development uses `http://localhost:3000` unless `ELECTRON_APP_URL` is set.

## Building for Distribution

```bash
bun run make:mac   # macOS .dmg and .zip
bun run make:win   # Windows installer
bun run make:linux # Linux .deb and .rpm
```

Forge outputs are written to `out/`.
