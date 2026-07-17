# NGLearn

**NGLearn** is a robust, full-stack administrative platform built to serve as the central nervous system for managing the NavGurukul alumni network. It acts as an overarching workspace where administrators, program managers, and operators can manage massive datasets (such as GHAR-imported data and Coursera learner metrics) securely. Simultaneously, it serves as a self-service profile portal for alumni (Members) to update their personal and professional details.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Technology Stack & Core Tooling
The application uses a highly modern, bleeding-edge React ecosystem to ensure high performance, security, and developer experience.

### Framework & Core Libraries
- **Framework:** [Next.js](https://nextjs.org/) using the App Router (`src/app`) for seamless Server Components, streaming, and nested layouts.
- **Language:** TypeScript for end-to-end type safety.
- **React:** React & React DOM.

### Styling & UI Components
- **CSS Engine:** [Tailwind CSS v4](https://tailwindcss.com/) with PostCSS.
- **Component Library:** [Shadcn UI](https://ui.shadcn.com/) which provides unstyled, accessible React components built on top of Radix UI primitives.
- **Icons:** `lucide-react` for consistent SVG iconography.
- **Data Visualization:** `recharts` for rendering interactive dashboard metrics and charts.
- **Toast Notifications:** `sonner` for highly responsive, non-intrusive alerts.

### Backend & Infrastructure
- **Database:** PostgreSQL hosted on [Supabase](https://supabase.com/).
- **Authentication:** `@supabase/ssr` (Server-Side Rendering Auth) and `@supabase/supabase-js`.
- **Data Parsing:** `xlsx` for parsing complex Excel and CSV imports directly within API routes or client components.

## Application Architecture

### Routing & Middleware
- **`src/middleware.ts`**: The application's frontline defense. It intercepts requests, validates the Supabase auth session, and redirects unauthorized users away from protected routes.
- **App Router (`src/app`)**:
  - **`(dashboard)/`**: The primary layout encompassing the Sidebar, Header, and main workspace. It fetches the user's role on the server and wraps the UI in a `UserProvider` Context.
  - **`api/alumni/`**, **`api/coursera/`**, **`api/contests/`**: API endpoints for heavy data processing.
  - **`auth/` & `login/`**: Handles login flows and Supabase OAuth callbacks.

### Roles, Teams, & Access Control
Access control in NGLearn is highly granular and managed via `src/lib/roles.ts`. Users can be Super Admin, Admin, Manager, Operator, Analyst, Viewer, Member, Program/Operations staff, or Volunteer.

## The Audit & Data Management Engine
Because NGLearn handles critical organizational data, it incorporates a foolproof audit engine (`src/lib/audit.ts`).
Whenever a row in tables like `alumni_master` is modified, a database trigger fires to append a detailed record into the `audit_log` table, guaranteeing that no change goes untracked.

## Core Modules & Dashboards
- **Data Management Hub (`/data-management`)**: Handles bulk data ingestion like GHAR Imports and Coursera Imports.
- **Contests (`/contests`)**: Manage and monitor ongoing student contests and metrics.
- **The Profile System**: Distinguishes between official organizational records (`alumni_master`) and self-service profile data (`alumni_profile`).

## License

MIT
