import express from 'express';

const router = express.Router();

// Get passwords from backend env (NOT prefixed with VITE_)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const EDITOR_PASSWORD = process.env.EDITOR_PASSWORD || '';
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || '';

// Rate limiting state (in production, consider using Redis)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    if (now > attempts.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

router.post('/login', async (req, res) => {
  const { password } = req.body;
  
  // Get real client IP (handle proxies like nginx)
  const ip = (
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  );

  // Rate limiting
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS && Date.now() < attempts.resetAt) {
    const remainingTime = Math.ceil((attempts.resetAt - Date.now()) / 1000 / 60);
    return res.status(429).json({
      error: 'Too many login attempts',
      message: `Please try again in ${remainingTime} minutes`,
    });
  }

  // Validate input
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid password' });
  }

  try {
    let role: string | null = null;

    // Log login attempt (no sensitive data)

    // Check against admin password
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      role = 'admin';
    }
    // Check against editor password
    else if (EDITOR_PASSWORD && password === EDITOR_PASSWORD) {
      role = 'editor';
    }
    // Check against viewer password
    else if (VIEWER_PASSWORD && password === VIEWER_PASSWORD) {
      role = 'viewer';
    }

    if (role) {
      // Success - clear rate limit
      loginAttempts.delete(ip);

      // Log successful login
      const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      console.log(`[AUTH] ✅ SUCCESS: ${role.toUpperCase()} login from ${ip} at ${timestamp}`);

      return res.json({ success: true, role });
    } else {
      // Failed login - increment attempts
      const current = loginAttempts.get(ip) || { count: 0, resetAt: 0 };
      loginAttempts.set(ip, {
        count: current.count + 1,
        resetAt: Date.now() + LOCKOUT_DURATION,
      });

      // Log failed attempt
      const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      console.warn(`[AUTH] ❌ FAILED: Invalid credentials from ${ip} at ${timestamp} (attempt ${current.count + 1}/${MAX_ATTEMPTS})`);

      return res.status(401).json({ 
        error: 'Invalid credentials',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (current.count + 1))
      });
    }
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;

