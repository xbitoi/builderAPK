# Workspace

## Overview

APK Builder Pro — a full-stack web application for converting web projects (React, Vue, Next.js, Angular, HTML) to Android APK/AAB files.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion

## Artifacts

- **apk-builder** (`/`) — Main APK Builder Pro web application
- **api-server** (`/api`) — Express backend API

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Features

- Dashboard with system readiness check (Java, Node, Git, Android SDK, Gradle)
- Projects management (create from GitHub URL, ZIP, or local path)
- Auto-detection of project framework type
- Build configuration (debug/release, APK/AAB, keystore signing)
- Live build monitor with terminal-style log viewer and step-by-step progress
- Keystore manager with key generation and password strength indicator
- Play Store preparation page with readiness checklist and store listing form
- Settings page with system tool status

## DB Schema

Tables: `projects`, `builds`, `keystores`
