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
- **Styling**: Tailwind CSS
- **Database**: Neon Serverless PostgreSQL
- **Routing**: React Router
- **Deployment**: GitHub Pages

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── admin/          # Admin/management components
│   │   ├── presentation/   # Slideshow components
│   │   └── common/         # Shared components
│   ├── contexts/           # React contexts for state
│   ├── hooks/              # Custom React hooks
│   ├── services/           # Database service layer
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── public/                 # Static assets
└── index.html             # HTML entry point
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Neon PostgreSQL database account ([sign up here](https://console.neon.tech/))

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.local.template` to `.env.local`
   - Add your Neon connection string:
     ```
     VITE_NEON_CONNECTION_STRING=postgresql://[user]:[password]@[host]/[database]?sslmode=require
     ```
   - Set an admin password for the bulk import feature:
     ```
     VITE_ADMIN_PASSWORD=your_secure_admin_password_here
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Database Setup

### Quick Setup

1. **Create the schema** on your Neon database:
   - Option A: Use the Neon SQL Editor (recommended)
     - Go to [Neon Console](https://console.neon.tech/)
     - Navigate to your project and branch
     - Open SQL Editor and run the contents of `database/schema.sql`
   
   - Option B: Use the setup script
     ```bash
     cd database
     ./setup.sh "your_neon_connection_string"
     ```

2. **Optional**: Load sample data for testing
   ```bash
   cd database
   ./seed.sh "your_neon_connection_string"
   ```
   
   This will populate your database with:
   - 5 sample singers
   - 8 devotional songs with lyrics and translations
   - 14 pitch associations
   
   See [`database/SEED_GUIDE.md`](./database/SEED_GUIDE.md) for quick instructions or [`database/README.md`](./database/README.md) for detailed setup information.

### Database Schema

The application uses three main tables:
- **songs**: Stores song information with lyrics and translations
- **singers**: Stores singer/vocalist profiles
- **song_singer_pitches**: Associates songs with singers and pitch information

See the complete schema in `database/schema.sql`

## Deployment to GitHub Pages

1. Update the `base` path in `vite.config.ts` to match your repository name
2. Build the project: `npm run build`
3. Deploy the `dist/` folder to the `gh-pages` branch

A GitHub Actions workflow will be added in a later task for automated deployment.

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

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT
