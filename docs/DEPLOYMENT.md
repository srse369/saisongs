# GitHub Pages Deployment

Deploy the Song Studio frontend as a static site to GitHub Pages.

**Note:** This deployment method only supports the frontend. The backend API will not be available. For full-stack deployment, see [DEPLOYMENT_VPS.md](./DEPLOYMENT_VPS.md).

## Quick Deploy

```bash
npm run build
npm run deploy
```

## Manual Setup

### 1. Configure Vite

Update `vite.config.ts` if your repository name differs from `songstudio`:

```typescript
base: '/your-repo-name/'
```

### 2. Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select the `gh-pages` branch and `/ (root)` folder
4. Click **Save**

### 3. Deploy

```bash
npm run build
npm run deploy
```

Your site will be available at: `https://[username].github.io/songstudio/`

## Automated Deployment (Optional)

Setup GitHub Actions for automatic deployment on push to `main`:

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Create `.github/workflows/deploy.yml`

The workflow will automatically build and deploy on every push.

## Troubleshooting

**404 on routes:** GitHub Pages doesn't support client-side routing by default. Add a `404.html` in `public/`:

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
</html>
```

**Assets not loading:** Verify the `base` path in `vite.config.ts` matches your repository name.
