# Deployment Guide

This document provides instructions for deploying the Song Studio application to GitHub Pages.

## Prerequisites

- GitHub repository with the project code
- Node.js 20 or higher installed locally
- Neon PostgreSQL database set up and configured

## Configuration

### 1. Vite Configuration

The `vite.config.ts` file is already configured with the base path for GitHub Pages:

```typescript
export default defineConfig({
  base: '/', // Update this to match your repository name
  // ...
})
```

**Important**: If your repository name is different from `songstudio`, update the `base` path to match your repository name.

### 2. Environment Variables

The application requires a Neon database connection string. This must be configured as a GitHub secret for automated deployments.

#### Setting up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:
   - **Name**: `VITE_NEON_CONNECTION_STRING`
   - **Value**: Your Neon database connection string (e.g., `postgresql://user:password@host/database?sslmode=require`)

#### Local Development

For local development, create a `.env.local` file in the `/` directory:

```bash
VITE_NEON_CONNECTION_STRING=postgresql://user:password@host/database?sslmode=require
```

**Note**: Never commit `.env.local` to version control. It's already included in `.gitignore`.

## Deployment Methods

### Method 1: Automated Deployment (Recommended)

The project includes a GitHub Actions workflow that automatically deploys to GitHub Pages on every push to the `main` branch.

#### Setup Steps

1. **Enable GitHub Pages**:
   - Go to your repository **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**

2. **Configure Secrets** (as described above)

3. **Push to Main Branch**:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

4. **Monitor Deployment**:
   - Go to the **Actions** tab in your repository
   - Watch the deployment workflow progress
   - Once complete, your site will be available at: `https://[username].github.io/songstudio/`

#### Manual Trigger

You can also manually trigger a deployment:

1. Go to the **Actions** tab
2. Select the **Deploy to GitHub Pages** workflow
3. Click **Run workflow**
4. Select the branch and click **Run workflow**

### Method 2: Manual Deployment

If you prefer to deploy manually without GitHub Actions:

1. **Install gh-pages package** (if not already installed):
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Build the application**:
   ```bash
   npm run build
   ```

3. **Deploy to GitHub Pages**:
   ```bash
   npm run deploy
   ```

   This will:
   - Build the application
   - Push the `dist` folder to the `gh-pages` branch
   - GitHub Pages will automatically serve from this branch

4. **Enable GitHub Pages** (if not already enabled):
   - Go to repository **Settings** → **Pages**
   - Under **Source**, select **Deploy from a branch**
   - Select the `gh-pages` branch and `/ (root)` folder
   - Click **Save**

## Verification

After deployment, verify your application:

1. **Access the URL**: `https://[username].github.io/songstudio/`
2. **Check functionality**:
   - Songs load correctly
   - Database connection works
   - Navigation functions properly
   - Presentation mode works

## Troubleshooting

### Build Fails

**Issue**: TypeScript compilation errors

**Solution**: Run `npm run build` locally to identify and fix errors before pushing

### Database Connection Fails

**Issue**: Application can't connect to Neon database

**Solutions**:
- Verify the `VITE_NEON_CONNECTION_STRING` secret is set correctly
- Ensure the connection string includes `?sslmode=require`
- Check that your Neon database is accessible from the internet
- Verify the database credentials are correct

### 404 Errors on Routes

**Issue**: Direct navigation to routes returns 404

**Solution**: GitHub Pages doesn't support client-side routing by default. Add a `404.html` that redirects to `index.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Song Studio</title>
    <script>
      sessionStorage.redirect = location.href;
    </script>
    <meta http-equiv="refresh" content="0;URL='/'">
  </head>
  <body></body>
</html>
```

### Assets Not Loading

**Issue**: CSS, JS, or images return 404

**Solution**: Verify the `base` path in `vite.config.ts` matches your repository name exactly

### Deployment Workflow Fails

**Issue**: GitHub Actions workflow fails

**Solutions**:
- Check the Actions tab for error logs
- Verify Node.js version compatibility
- Ensure all dependencies are in `package.json`
- Check that GitHub Pages is enabled in repository settings

## Updating the Deployment

To update your deployed application:

1. Make your code changes
2. Commit and push to the `main` branch
3. GitHub Actions will automatically rebuild and redeploy
4. Changes will be live in 2-5 minutes

## Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `public` folder with your domain name
2. Configure DNS settings with your domain provider
3. Update GitHub Pages settings to use your custom domain
4. Update the `base` path in `vite.config.ts` to `/`

## Performance Optimization

For production deployments:

- The build is already configured with minification (`terser`)
- Source maps are disabled for smaller bundle size
- Consider enabling compression on your CDN/hosting
- Monitor bundle size with `npm run build -- --report`

## Security Considerations

- **Never commit** `.env.local` or any files containing database credentials
- Use GitHub Secrets for sensitive environment variables
- Regularly rotate database credentials
- Consider using a read-only database user for the frontend if possible
- Enable SSL/TLS for database connections (already configured with `?sslmode=require`)

## Rollback

To rollback to a previous version:

1. Go to the **Actions** tab
2. Find the successful deployment you want to rollback to
3. Click **Re-run all jobs**

Alternatively, revert your git commits and push to trigger a new deployment.

## Support

For issues or questions:
- Check the GitHub Actions logs for deployment errors
- Review the browser console for runtime errors
- Verify database connectivity and credentials
- Ensure all prerequisites are met
