# POW (Proof of Work) Application

## Overview
POW is an artifact tracking application that helps users document their work with discipline and clarity. Users can create artifacts (documents), track proof units (evidence of work done), and complete artifacts with immutable snapshots.

## Core Features
- **Simple Authentication**: Token-based auth with user ID (no password for MVP)
- **Artifacts**: Create documents with types like SOP, checklist, workflow, playbook, etc.
- **Proof Units**: Track work done on artifacts with modes (operator/steward) and types (ship/decide/document/automate/review)
- **Complete Workflow**: Mark artifacts as complete with finish summary, creating immutable snapshots
- **Revisions**: Create new drafts from completed artifacts
- **RTV Tags**: Automatic tagging based on artifact structure (internal_leverage, client_facing_assets, etc.)

## Phase 1 Features
- **Search & Filter**: Search artifacts by title, filter by type and status (draft/complete/archived)
- **Archive System**: Archive completed artifacts to hide from default view, restore when needed
- **Markdown Export**: Export completed artifacts as .md files with metadata
- **Activity Log**: Track all major actions (created, updated, proof_added, completed, revised, archived, restored)
- **POW Manual**: In-app documentation explaining the POW philosophy and system (accessible via book icon in header)

## Tech Stack
- **Frontend**: React with TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter for client-side routing
- **State**: Direct fetch API calls for data fetching

## Project Structure
```
client/
  src/
    components/       # React components
      artifact-editor.tsx    # Create/edit artifacts
      artifact-list.tsx      # Sidebar artifact list
      complete-artifact.tsx  # Complete artifact dialog
      login-form.tsx         # Login form
      proof-units.tsx        # Proof units management
      snapshot-view.tsx      # View completed artifacts
      theme-provider.tsx     # Dark/light theme
      theme-toggle.tsx       # Theme toggle button
      ui/                    # shadcn/ui components
    lib/
      api.ts          # API client with token management
      queryClient.ts  # React Query setup
    pages/
      home.tsx        # Main workspace
      not-found.tsx   # 404 page
    App.tsx           # Root component with routing
server/
  auth.ts           # Token signing/verification
  db.ts             # Database connection
  routes.ts         # API endpoints
  seed.ts           # Demo data seeding
  storage.ts        # Data access layer
shared/
  schema.ts         # Drizzle schema and TypeScript types
```

## API Endpoints
- `POST /auth/issue` - Issue authentication token
- `GET /api/artifacts` - List user's artifacts (paginated, with search/filter params)
- `POST /api/artifacts` - Create new artifact
- `GET /api/artifacts/:id` - Get artifact details
- `PATCH /api/artifacts/:id` - Update draft artifact
- `GET /api/artifacts/:id/proof-units` - List proof units
- `POST /api/artifacts/:id/proof-units` - Add proof unit
- `POST /api/artifacts/:id/complete` - Complete artifact
- `POST /api/artifacts/:id/revise` - Create revision from completed artifact
- `GET /api/artifacts/:id/snapshot/:snapshotId` - Get snapshot
- `POST /api/artifacts/:id/archive` - Archive completed artifact
- `POST /api/artifacts/:id/restore` - Restore archived artifact
- `GET /api/activity-events` - List activity events for user

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `POW_AUTH_SECRET` - Secret for signing auth tokens

## Artifact Types
- note, sop, checklist, playbook, template, workflow, spec, principles, journal, other

## Proof Modes
- **Operator**: Doing the work directly
- **Steward**: Overseeing or reviewing work

## Proof Types
- **Ship**: Delivered something
- **Decide**: Made a decision
- **Document**: Documented process/knowledge
- **Automate**: Created automation
- **Review**: Reviewed work

## Artifact Structure Properties
- audience: internal | external | unknown
- includesWhy: boolean
- reusable: boolean
- hasStepsOrProcess: boolean
- coordinatesToolsOrAgents: boolean
- expressesValues: boolean
- thinkingOnly: boolean

## Finish Criteria
Each artifact can have:
- `doneDefinition`: What must be true for this to be done
- `checks`: List of checkable items
- `blockers`: Optional list of blockers

## Running the App
```bash
npm run dev    # Start development server
npm run db:push  # Push schema changes to database
```

## Demo Data
Login with user ID "demo" to see pre-seeded example artifacts including:
- Customer Onboarding SOP
- Weekly Planning Checklist
- API Integration Workflow
- Team Communication Guidelines
