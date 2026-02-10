# NCAA Swim & Dive Tracker

A modern, interactive web application for tracking NCAA Division 1 Swimming & Diving teams and athletes. Features real-time filtering, conference grouping, and beautiful animations.

## Features

- Real-time team and athlete filtering by gender, division, and conference
- Interactive team cards with roster viewing
- Detailed athlete profiles with event specialties
- Conference-based organization with collapsible sections
- Smooth animations and transitions using Framer Motion
- Responsive design optimized for all devices
- Fast performance with Next.js 14 App Router
- Type-safe development with TypeScript

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Animations:** Framer Motion
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel
- **Package Manager:** npm

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (free tier works)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd ncaa-swim-dive-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Edit `.env.local` and add your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Database Setup

5. Run the SQL migrations in your Supabase SQL Editor:

First, run the schema migrations in order:
```bash
# Run these in the Supabase SQL Editor:
# 1. supabase/migrations/001_create_teams_table.sql
# 2. supabase/migrations/002_create_athletes_table.sql
```

6. Populate the database with team and athlete data:
```bash
npm run migrate
```

This will:
- Seed all NCAA D1 Swimming & Diving teams
- Add sample athletes to each team
- Set up proper relationships and data

### Development

7. Start the development server:
```bash
npm run dev
```

8. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run migrate` - Run data migration script

## Project Structure

```
ncaa-swim-dive-tracker/
├── app/                    # Next.js app router pages
│   ├── layout.tsx         # Root layout with metadata
│   └── page.tsx           # Main page with filtering logic
├── components/            # React components
│   ├── ui/               # Base UI components (Badge, Card, Button)
│   ├── Navigation.tsx    # Top navigation bar
│   ├── HeroSection.tsx   # Hero banner with filters
│   ├── FilterPills.tsx   # Filter pill buttons
│   ├── TeamCard.tsx      # Team card with roster
│   ├── AthleteCard.tsx   # Athlete detail card
│   └── ConferenceSection.tsx  # Conference grouping
├── lib/                   # Utilities and helpers
│   ├── supabase.ts       # Supabase client
│   ├── types.ts          # TypeScript types
│   └── utils.ts          # Utility functions
├── public/               # Static assets
│   └── logos/           # Team logo images
├── supabase/            # Database migrations
│   └── migrations/      # SQL migration files
└── scripts/             # Data migration scripts
    └── migrate-data.ts  # Team and athlete seeding
```

## Database Schema

### Teams Table
- id (uuid, primary key)
- name (text)
- conference (text)
- division (text)
- gender (text: Men's, Women's, Both)
- logo_url (text)
- roster_count (integer)

### Athletes Table
- id (uuid, primary key)
- team_id (uuid, foreign key)
- name (text)
- year (text: FR, SO, JR, SR)
- events (text array)
- hometown (text)

## Deployment

### Deploy to Vercel

1. Push your code to GitHub

2. Import your repository in [Vercel](https://vercel.com)

3. Configure environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Deploy! Vercel will automatically build and deploy your app.

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

See `.env.local.example` for a template.

## Features in Detail

### Filtering System
- Filter by gender (Men's, Women's, Both)
- Filter by division (D1, D2, D3)
- Filter by conference (ACC, Big Ten, Pac-12, etc.)
- Real-time updates with smooth animations

### Team Cards
- Display team name, conference, and logo
- Show roster count
- Expandable roster view with all athletes
- Smooth expand/collapse animations

### Athlete Cards
- Display athlete name, year, and hometown
- Show event specialties with color-coded badges
- Responsive grid layout

### Conference Sections
- Group teams by conference
- Collapsible sections with team counts
- Animated expand/collapse

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with Next.js, React, and Tailwind CSS
- Powered by Supabase
- Deployed on Vercel
