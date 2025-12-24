# SplitWise Clone - Expense Splitting Application

## Overview

This is a full-stack expense splitting application built for tracking shared expenses among groups of people. Users can create groups, add participants (individuals or sub-groups with weighted members), log expenses with multi-currency support, and calculate settlement amounts to balance debts between participants.

The application follows a monorepo structure with a React frontend, Express backend, and PostgreSQL database using Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration
- **Forms**: React Hook Form with Zod validation
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints defined in shared/routes.ts
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: shared/schema.ts (shared between frontend and backend)
- **File Uploads**: Presigned URL flow with Google Cloud Storage integration via Replit Object Storage

### Data Model
- **Groups**: Container for participants and expenses, has a base currency
- **Participants**: Can be individuals or groups with weighted sub-members
- **Expenses**: Tracks amount, currency, exchange rate, payer, and split type
- **Expense Splits**: Junction table tracking how each expense is divided among participants
- **Conversion Rates**: Stores currency exchange rates

### Key Design Decisions

1. **Shared Schema Pattern**: Database schema and Zod validation schemas are defined in `shared/schema.ts`, enabling type-safe API contracts between frontend and backend.

2. **Weighted Participant Groups**: Participants can be "group" type with sub-members having different weights, allowing flexible expense splitting (e.g., a family counting as 3 shares).

3. **Multi-Currency Support**: Expenses can be logged in any currency with exchange rates, automatically converted to the group's base currency for settlement calculations.

4. **Presigned URL Uploads**: Receipt images are uploaded directly to object storage using presigned URLs, avoiding server memory/bandwidth overhead.

5. **Participant Editing & Type Conversion**: Participants can be edited (name, weight) and converted between individual and group types. The system shows affected expenses before conversion and requires force confirmation when related expenses exist. Converting a group to individual reassigns any expenses paid by child members to the parent participant before deleting the children.

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via DATABASE_URL environment variable
- **Drizzle ORM**: Type-safe database queries with schema-first approach
- **Drizzle Kit**: Database migration tool (run with `npm run db:push`)

### Cloud Services
- **Google Cloud Storage**: File storage for receipt images via Replit Object Storage integration
- **Replit Sidecar**: Authentication proxy for GCS access (localhost:1106)

### Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **@uppy/core + @uppy/aws-s3**: File upload handling with presigned URLs
- **date-fns**: Date formatting
- **zod**: Runtime schema validation
- **framer-motion**: UI animations
- **react-hook-form**: Form state management

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `PUBLIC_OBJECT_SEARCH_PATHS`: (Optional) Paths for public object access