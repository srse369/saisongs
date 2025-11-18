# Song Studio

A web-based song presentation system that displays devotional songs (bhajans) in a PowerPoint-style slideshow format. Built with React, TypeScript, and Neon PostgreSQL.

## Features

- 📝 Manage songs with lyrics and English translations
- 👤 Track singers and their pitch information
- 🎵 Associate musical pitch data with song-singer combinations
- 📊 Present songs in full-screen slideshow mode
- 🔍 Search and filter songs
- ⌨️ Keyboard navigation in presentation mode

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Styling**: Tailwind CSS
- **Database**: Oracle Database
- **Routing**: React Router
- **Deployment**: GitHub Pages or VPS

## Project Structure

```
.
├── src/                    # Frontend source code
│   ├── components/
│   │   ├── admin/          # Admin/management components
│   │   ├── presentation/   # Slideshow components
│   │   └── common/         # Shared components
│   ├── contexts/           # React contexts for state
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Database service layer
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── server/                 # Backend source code
│   ├── routes/             # API routes
│   └── services/           # Backend services
├── database/               # Database schemas and migrations
├── deploy/                 # Deployment configurations
│   ├── local/              # Local development config
│   └── remote/             # Remote server deployment
├── docs/                   # Documentation
└── public/                 # Static assets
```

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- Oracle Database access
- (Optional) Remote server for production deployment

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy the template file:
     ```bash
     cp deploy/local/.env.local.template .env.local
     ```
   - Edit `.env.local` with your Oracle database credentials:
     ```
     DB_USER=your_db_username
     DB_PASSWORD=your_db_password
     DB_CONNECTION_STRING=your_connection_string
     ADMIN_PASSWORD=your_secure_admin_password_here
     ```

4. Run the development server:
   ```bash
   # Start both frontend and backend
   npm run dev:all
   
   # Or run separately:
   npm run dev        # Frontend only (port 5173)
   npm run dev:server # Backend only (port 3001)
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Database Setup

### Quick Setup

1. **Create the schema** on your Oracle database:
   - Run the contents of `database/schema_oracle.sql` in your Oracle database
   - You can use SQL*Plus, SQL Developer, or any Oracle SQL client

2. **Load sample data** (optional):
   - See the `database/` directory for sample data files
   - Refer to [`database/README_DATA_LOADING.md`](./database/README_DATA_LOADING.md) for loading instructions
   - See [`database/ORACLE_MIGRATION.md`](./database/ORACLE_MIGRATION.md) for migration details

### Database Schema

The application uses three main tables:
- **songs**: Stores song information with lyrics and translations
- **singers**: Stores singer/vocalist profiles
- **song_singer_pitches**: Associates songs with singers and pitch information

See the complete schema in `database/schema_oracle.sql`

## Deployment

### Option 1: VPS/Remote Server (Recommended for Full Stack)

Deploy to a remote server (e.g., 141.148.149.54) with full backend support:

```bash
# One-time setup on server
ssh ubuntu@141.148.149.54
bash deploy/remote/server-setup.sh

# Deploy from local machine
./deploy/remote/deploy.sh production
# or
npm run deploy:vps
```

See **[docs/DEPLOYMENT_VPS.md](./docs/DEPLOYMENT_VPS.md)** for detailed instructions.

### Option 2: GitHub Pages (Frontend Only)

Deploy static frontend to GitHub Pages:

1. Update the `base` path in `vite.config.ts` to match your repository name
2. Build the project: `npm run build`
3. Deploy: `npm run deploy`

See **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** for detailed GitHub Pages deployment instructions.

## Admin Features

### Bulk Import from Sairhythms.org

The application includes a hidden bulk import feature for administrators to import all songs from sairhythms.org into the database.

**Accessing the Bulk Import:**
1. Ensure `VITE_ADMIN_PASSWORD` is set in your `.env.local` file
2. Press **Ctrl+Shift+I** (Windows/Linux) or **Cmd+Shift+I** (Mac) to open the password dialog
3. Enter the admin password
4. The bulk import interface will appear, allowing you to import all songs from sairhythms.org

**Features:**
- Discovers all available songs on sairhythms.org
- Preserves existing song IDs to maintain data integrity
- Updates existing songs and creates new ones
- Real-time progress tracking
- Error handling and reporting

**Security:**
- The feature is hidden from regular users (no visible UI elements)
- Password-protected access
- Rate limiting after 5 failed password attempts (5-minute lockout)

## Development

### Available Scripts

- `npm run dev` - Start frontend development server
- `npm run dev:server` - Start backend development server
- `npm run dev:all` - Start both frontend and backend
- `npm run build` - Build frontend for production (GitHub Pages)
- `npm run build:vps` - Build frontend for VPS deployment
- `npm run build:server` - Build backend for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run deploy` - Deploy to GitHub Pages
- `npm run deploy:vps` - Deploy to VPS server

## License

MIT
