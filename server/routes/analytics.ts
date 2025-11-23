import express from 'express';
import { analyticsService } from '../services/AnalyticsService.js';
import { requireAdmin } from '../middleware/simpleAuth.js';

const router = express.Router();

// Track page visit (client-side beacon)
router.post('/track', async (req, res) => {
  try {
    const { path, referrer, clientIp } = req.body;
    
    // Use client-detected public IP if provided, otherwise fall back to request IP
    let ipAddress = clientIp;
    
    if (!ipAddress) {
      // Fallback: Get IP from request headers (handle proxies like nginx)
      ipAddress = (
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        req.headers['x-real-ip']?.toString() ||
        req.socket.remoteAddress ||
        req.ip ||
        'unknown'
      );
    }

    const userRole = (req.headers['x-user-role'] as string) || 'public';

    console.log(`[Analytics] 📊 Track: ${userRole} → ${path || '/'} from ${ipAddress || 'unknown IP'}`);

    // Track asynchronously (respond immediately)
    setImmediate(() => {
      analyticsService.trackVisitor({
        ipAddress,
        userAgent: req.headers['user-agent'],
        pagePath: path || '/',
        referrer,
        userRole
      }).catch(error => {
        console.error('[Analytics] Track visitor error:', error.message);
      });
    });

    // Respond immediately
    res.status(204).send();
  } catch (error) {
    // Don't fail - just log
    console.error('[Analytics] ❌ Error in track endpoint:', error);
    res.status(204).send(); // Still send success to avoid client errors
  }
});

// Get analytics summary (admin only)
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const summary = await analyticsService.getAnalyticsSummary(days);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

// Get location markers for map (admin only)
router.get('/locations', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const locations = await analyticsService.getLocationMarkers(days);
    res.json(locations);
  } catch (error) {
    console.error('Error fetching location markers:', error);
    res.status(500).json({ error: 'Failed to fetch location markers' });
  }
});

export default router;

