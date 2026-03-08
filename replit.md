# POW (Proof of Work) Application

## Overview
POW is an artifact tracking application and cross-terminal proof ledger for the TalonSight infrastructure. Users can create artifacts (documents), track proof units (evidence of work done), and complete artifacts with immutable snapshots. The POW Ledger layer records proof-worthy events from any terminal in the TalonSight ecosystem, providing provenance, lineage, and verification.

## Architecture: TalonSight Infrastructure Role
POW Ledger serves as the **trust layer** in TalonSight infrastructure:
- **Terminals create value** (Sonic Genesis, TalonVision, Da Cypher, TalonFly, Decipher, SignGenesis)
- **Infrastructure manages value** (auth, projects, artifacts, workflows)
- **POW Ledger proves value** (hashes, lineage, decisions, ownership, verification)

The ledger sits downstream of actions but upstream of trust features. It records proof-worthy events with SHA-256 hashing for integrity verification.

## Core Features
- **Simple Authentication**: Token-based auth with user ID (no password for MVP)
- **Artifacts**: Create documents with types like SOP, checklist, workflow, playbook, etc.
- **Proof Units**: Track work done on artifacts with modes (operator/steward) and types (ship/decide/document/automate/review)
- **Complete Workflow**: Mark artifacts as complete with finish summary, creating immutable snapshots
- **Revisions**: Create new drafts from completed artifacts
- **RTV Tags**: Automatic tagging based on artifact structure (internal_leverage, client_facing_assets, etc.)

## Strategic Features
- **Scope Creep Flag**: Mark artifacts as scope expansion (amber/warning styling)
- **Intentional Pause**: Pause drafts with a reason, resume later (blue styling)
- **Black Box Export**: Sealed JSON export with SHA-256 integrity hash (POW_BLACK_BOX_v1 format)
- **Drift Visualization**: Compare ArtifactStructure between current and parent snapshot

## POW Ledger (Infrastructure Layer)
- **Ledger Entries**: Normalized `ledger_entries` table recording proof-worthy events from any terminal
- **Proof Ingestion API**: `POST /api/ledger/record` — standardized `recordProofEvent()` endpoint
- **Verification API**: `GET /api/ledger/verify/:id` — integrity check with recomputed SHA-256 hash
- **Lineage API**: `GET /api/ledger/lineage/:artifactId` — full proof chain for an artifact
- **Auto-emit**: POW actions (create, complete, revise, archive, proof_added) automatically emit ledger entries with `terminalSource: "POW"`
- **Ledger Dashboard**: UI accessible via ScrollText icon in header, with terminal/event filters, entry detail dialog, integrity verification, and lineage timeline

## Tech Stack
- **Frontend**: React with TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: wouter for client-side routing
- **State**: Direct fetch API calls for data fetching
- **Hashing**: Node.js crypto (server-side SHA-256), Web Crypto API (client-side Black Box Export)

## Project Structure
```
client/
  src/
    components/
      artifact-editor.tsx    # Create/edit artifacts
      artifact-list.tsx      # Sidebar artifact list
      complete-artifact.tsx  # Complete artifact dialog
      ledger-dashboard.tsx   # POW Ledger dashboard with filters, detail, lineage
      login-form.tsx         # Login form
      proof-units.tsx        # Proof units management
      snapshot-view.tsx      # View completed artifacts (includes Black Box Export, Drift Viz)
      theme-provider.tsx     # Dark/light theme
      theme-toggle.tsx       # Theme toggle button
      ui/                    # shadcn/ui components
    lib/
      api.ts          # API client with token management (includes ledger APIs)
      queryClient.ts  # React Query setup
    pages/
      home.tsx        # Main workspace (includes ledger toggle)
      not-found.tsx   # 404 page
    App.tsx           # Root component with routing
server/
  auth.ts           # Token signing/verification
  db.ts             # Database connection
  routes.ts         # API endpoints (includes ledger endpoints)
  seed.ts           # Demo data seeding
  storage.ts        # Data access layer (includes ledger storage + auto-emit)
shared/
  schema.ts         # Drizzle schema and TypeScript types (includes ledger_entries)
```

## API Endpoints

### Authentication
- `POST /auth/issue` - Issue authentication token

### Artifacts
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
- `POST /api/artifacts/:id/pause` - Pause draft artifact
- `POST /api/artifacts/:id/resume` - Resume paused artifact
- `GET /api/activity` - List activity events for user

### POW Ledger
- `POST /api/ledger/record` - Record a proof event (cross-terminal ingestion)
- `GET /api/ledger/entries` - List ledger entries (with filters: projectId, terminalSource, artifactId, eventType, actorId)
- `GET /api/ledger/entries/:id` - Get single ledger entry
- `GET /api/ledger/lineage/:artifactId` - Get lineage chain for an artifact
- `GET /api/ledger/verify/:id` - Verify ledger entry integrity (recomputes SHA-256 hash)

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `POW_AUTH_SECRET` - Secret for signing auth tokens

## Ledger Entry Schema
```
ledger_entries:
  id, projectId, workspaceId, terminalSource, artifactType,
  artifactId, eventType, actorId, parentArtifactId, artifactHash,
  modelId, modelVersion, permissionScope, signature, metadata, createdAt
```

## Ledger Event Types
- `artifact_created`, `artifact_revised`, `artifact_approved`
- `prompt_used`, `model_version_recorded`, `collaborator_contribution`
- `ownership_transfer`, `export_published`, `deliverable_completed`
- `decision_checkpoint`, `scope_change_acknowledged`

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
