# Certificator

A Zero-Cost Certificate Generation Platform running on Vercel (Free Tier) and Supabase (Free Tier).

## 🎯 Project Philosophy

**Zero-Cost Architecture**: This project is designed to run indefinitely on free tiers without any paid services. It bridges the physical and digital worlds by allowing users to create, manage, and generate PDF certificates with custom layouts.

**Defensive Design**: Built with aggressive caching, robust error handling, and awareness of free tier limitations (database pausing, bandwidth limits, serverless timeouts).

## 🏗️ Architecture

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Auth)
- **Deployment**: Vercel (Free Tier)
- **Security**: Row Level Security (RLS) for complete data isolation

## 📋 Prerequisites

- Node.js 20+ and npm
- Supabase account (free tier)
- Vercel account (free tier) for deployment

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/mutalibAbd/Certificator.git
cd Certificator
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API to get your credentials
3. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
4. Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   KEEP_ALIVE_SECRET=your-keep-alive-secret
   ```

### 3. Run Database Migrations

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/migrations/20240101000000_initial_schema.sql`
4. Paste and execute the SQL
5. Verify tables are created: `templates`, `layouts`, `system_health`

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
Certificator/
├── app/                    # Next.js App Router pages
├── lib/                    # Utility functions
│   └── supabase.ts        # Supabase client initialization
├── types/                  # TypeScript type definitions
│   └── database.types.ts  # Database schema types
├── supabase/              # Database migrations
│   └── migrations/        # SQL migration files
├── public/                # Static assets
├── .github/               # GitHub configuration
│   ├── agent/            # Agent personas (Architect, Frontend, Backend, Typesetter)
│   └── copilot-instructions.md  # Project constitution
└── .env.local.example     # Environment variables template
```

## 🗄️ Database Schema

### `templates` Table
Stores PDF template metadata (PDFs stored in Supabase Storage).

| Column      | Type         | Description                          |
|-------------|--------------|--------------------------------------|
| id          | UUID         | Primary key                          |
| owner_id    | UUID         | Foreign key to auth.users            |
| image_url   | TEXT         | URL to image in Supabase Storage     |
| name        | TEXT         | User-defined template name           |
| created_at  | TIMESTAMPTZ  | Creation timestamp                   |

### `layouts` Table
Stores field configurations using JSONB for flexibility.

| Column      | Type         | Description                                    |
|-------------|--------------|------------------------------------------------|
| id          | UUID         | Primary key                                    |
| template_id | UUID         | Foreign key to templates                       |
| config      | JSONB        | Array of fields: `[{id, x, y, font, size}]`   |
| created_at  | TIMESTAMPTZ  | Creation timestamp                             |
| updated_at  | TIMESTAMPTZ  | Last update timestamp (auto-updated)           |

**Important**: Coordinates in `config` use Browser coordinate system (Top-Left origin). Convert to PDF coordinates (Bottom-Left origin) when rendering.

### `system_health` Table
Keep-alive mechanism to prevent database pausing.

| Column      | Type         | Description                          |
|-------------|--------------|--------------------------------------|
| id          | UUID         | Primary key                          |
| last_pulse  | TIMESTAMPTZ  | Last keep-alive ping timestamp       |
| status      | TEXT         | System status (healthy/degraded/offline) |
| created_at  | TIMESTAMPTZ  | Creation timestamp                   |

**Security**: Only accessible via service role key. Public anon key has zero access.

## 🔒 Security Model

Row Level Security (RLS) is enabled on all tables:

- **templates & layouts**: Users can only SELECT, INSERT, UPDATE, DELETE their own data
- **system_health**: Only service_role can access (keep-alive mechanism)

All authentication is handled by Supabase Auth with complete data isolation between users.

## 🎨 Coordinate Systems

**Critical**: This project bridges two coordinate systems:

- **Browser**: Top-Left origin (0,0) at upper-left corner
- **PDF**: Bottom-Left origin (0,0) at lower-left corner

Utility functions in `types/database.types.ts`:
- `browserToPDF()`: Convert Browser → PDF coordinates
- `pdfToBrowser()`: Convert PDF → Browser coordinates

## 📦 Build and Deploy

### Build Locally

```bash
npm run build
npm start
```

### Deploy to Vercel

1. Push your code to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

**Free Tier Limits**:
- 5GB bandwidth/month
- 100GB-hours compute/month
- Optimize assets (fonts, PDFs) aggressively

## 🔧 Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

## 🤝 Contributing

This project follows a specific architecture defined in `.github/copilot-instructions.md`. Please review the project constitution before contributing.

## 📄 License

MIT License - See LICENSE file for details
