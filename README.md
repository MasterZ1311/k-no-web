# káno̱ Web (kah-noh)

> **Shared notes and productivity application built for structured thinking, seamless real-time synchronization, and robust web resilience.**

káno̱ Web is the web-native, browser-optimized client of **káno̱**, designed for PC browsers and ready for zero-configuration hosting on **Vercel**. It provides complete functional parity with the Windows Desktop client, connecting to the shared, authoritative **Supabase** backend (PostgreSQL 15+, Supabase Auth, Storage, and Realtime) to ensure all devices and workspaces remain in live bidirectional sync.

---

## 1. Architecture & Multi-Client Synchronization

```
                                  ┌───────────────────────────┐
                                  │      Authoritative        │
                                  │     Supabase Backend      │
                                  │  (Postgres 15+, RLS,      │
                                  │   Realtime, Storage)      │
                                  └─────────────┬─────────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       │                        │                        │
                       ▼                        ▼                        ▼
         ┌───────────────────────────┐  ┌──────────────┐  ┌───────────────────────────┐
         │       káno̱ Web            │  │ káno̱ Desktop │  │       káno̱ Mobile         │
         │  (Vercel / React + Vite)  │  │  (Electron)  │  │     (Android / Room)      │
         └───────────────────────────┘  └──────────────┘  └───────────────────────────┘
```

### Real-Time Synchronization Engine
- **Live Postgres Changes**: When notes, folders, tasks, boards, or calendar events are modified in any client, Supabase Realtime broadcasts change events over WebSocket channel `realtime:room:<roomId>`.
- **Bidirectional Parity**: Any edit made in káno̱ Web is immediately reflected in the Desktop client, and any edit in Desktop is immediately pushed to the Web client.
- **Optimistic Concurrency**: Note modifications use atomic version checks via the `update_note_with_version` PostgreSQL stored procedure, preventing silent overwrites and detecting race conditions deterministically.
- **Unified Schemas**: Shares the exact canonical AST format (`kano/doc/v1`), wire DTOs, and relational tables across all platforms.

---

## 2. Feature Suite

| Module | Features |
| :--- | :--- |
| **Authentication** | Email & password registration, sign-in, email confirmation, password recovery/reset, automatic PKCE/hash callback exchange, and secure persistent session management. |
| **Private Rooms** | Isolated team or personal workspaces, role-based access (`owner`, `member`), member list, revocable invite tokens with expiration and use limits, token redemption, ownership transfer, and member removal. |
| **Hierarchical Folders** | Unlimited nested folder hierarchies, drag/move folders, rename, soft-delete, and real-time per-folder note count badges. |
| **Rich-Text Notes** | Tiptap-powered block editor supporting headings (H1-H3), bullet lists, numbered lists, interactive checklists, code blocks with syntax highlighting, inline formatting (bold, italic, strikethrough, code, hyperlinks), autosave with version conflict detection, pinning, starring (favorites), and soft-deletion (trash & restore). |
| **Attachments** | Secure file upload to Supabase Storage bucket `room-attachments`, signed URLs (1-hour validity), attachment previews, and safe deletion. |
| **Tasks & Kanban** | 4-column Kanban board (`Todo`, `In Progress`, `Blocked`, `Done`), drag-and-drop task progression, task checklists, color-coded labels, priority tiers (`Low`, `Medium`, `High`, `Urgent`), deadline pickers, and assignee management. |
| **Calendar Scheduling** | Interactive month grid and day/event agenda, deadline badges, task-linked calendar events, and date navigation. |
| **Activity Trail** | Real-time audit log recording creations, edits, deletions, moves, and membership changes across the workspace. |
| **Web Notifications & Reminders** | Web Notifications API integration with permission management, task due date alerts, deduplication window, and in-app toast fallbacks. |
| **Export Engine** | Export individual notes or full workspaces to standard GitHub Flavored Markdown (with YAML frontmatter) or JSON, with instant browser file download. |
| **Theme & Customization** | Light, Dark, and System theme synchronization, sidebar collapse, reduced motion support, and local cache clearing. |

---

## 3. Technology Stack

- **Framework**: React 18.3+ with TypeScript in strict mode
- **Bundler & Dev Server**: Vite 6+
- **Styling**: Tailwind CSS 3.4+ with custom káno̱ design system tokens and CSS variables
- **Rich-Text Editor**: TipTap 3+ with StarterKit, TaskList, TaskItem, Underline, and Link extensions
- **Icons**: Lucide React
- **Backend / Database Client**: `@supabase/supabase-js` 2.49+
- **Testing**: Vitest 3+, `@testing-library/react`, JSDOM
- **Hosting Target**: Vercel (Single Page Application with `vercel.json` rewrites and HTTP security headers)

---

## 4. Getting Started Locally

### Prerequisites
- Node.js v20+ or v22+
- npm v10+

### Installation & Development
1. Navigate to the project directory:
   ```bash
   cd "e:\Github\káno̱ web"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your Supabase connection:
   Create a `.env.local` file from `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   Provide your Supabase URL and public anonymous key:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   ```
4. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Deploying to Vercel

káno̱ Web is pre-configured for frictionless deployment to Vercel:

### Method A: Deploy via Vercel Dashboard (Recommended)
1. Push your repository to GitHub, GitLab, or Bitbucket.
2. In the [Vercel Dashboard](https://vercel.com/new), select **Import Project** and choose the `káno̱ web` repository.
3. Framework Preset will automatically detect **Vite**.
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (e.g. `https://xyz.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase public anonymous API key.
5. Click **Deploy**. Vercel will build and serve your site with HTTPS and global edge routing.

### Method B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel login
vercel
# When prompted for environment variables, provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
vercel --prod
```

### In-App First-Run Setup (Fallback)
If you deploy without environment variables, káno̱ Web will display a setup screen where you can paste your Supabase Project URL and Public Anon Key directly. The credentials are encrypted and stored in browser `localStorage`, allowing immediate workspace connection. You can also reconfigure or view backend connection details at any time in **Settings**.

---

## 6. Verification & Quality Assurance

Run the test suite and typechecks:

```bash
# Typecheck TypeScript codebase
npm run typecheck

# Execute unit and contract test suites
npm test

# Generate production build
npm run build
```

---

## 7. Security Architecture

- **Row Level Security (RLS)**: All queries and mutations are executed strictly in the context of the authenticated user's session and governed by PostgreSQL RLS policies.
- **No Service Keys**: Only client-safe, public anonymous keys are included or accepted in the web application.
- **Security Headers**: `vercel.json` provides strict security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`).
- **Sanitized Exports & URLs**: All external URLs and exports are validated and sanitized to prevent protocol injection.
