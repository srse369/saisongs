import express from 'express';
import { databaseReadService } from '../services/DatabaseReadService.js';
import { databaseWriteService } from '../services/DatabaseWriteService.js';
import { emailService } from '../services/EmailService.js';

const router = express.Router();

// Rate limiting state (in production, consider using Redis)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRATION_MS = 60 * 1000; // 1 minute

// Clean up expired rate limit entries and OTP codes periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    if (now > attempts.resetAt) {
      loginAttempts.delete(ip);
    }
  }
  
  // Clean up expired OTP codes from database
  databaseWriteService.cleanupExpiredOTPs().catch(err => {
    console.error('[AUTH] Error cleaning up OTP codes:', err);
  });
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Generate a random 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get client IP address (handle proxies)
 */
function getClientIP(req: express.Request): string {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.headers['x-real-ip']?.toString() ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

/**
 * POST /api/auth/request-otp
 * Request OTP code to be sent to email
 */
router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  
  // Get client IP for rate limiting
  const ip = getClientIP(req);

  // Rate limiting
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS && Date.now() < attempts.resetAt) {
    const remainingTime = Math.ceil((attempts.resetAt - Date.now()) / 1000 / 60);
    return res.status(429).json({
      error: 'Too many requests',
      message: `Please try again in ${remainingTime} minutes`,
    });
  }

  // Validate email
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if user exists with this email
    const user = await databaseReadService.getUserBasicInfo(normalizedEmail);

    if (!user) {
      // User not found - inform them to contact their center
      console.log(`[AUTH] OTP requested for non-existent email: ${normalizedEmail}`);
      return res.status(404).json({ 
        error: 'Email not found',
        message: 'Please contact your nearest center to get access.' 
      });
    }

    // Generate OTP code
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    // Store OTP in database
    await databaseWriteService.insertOTPCode(normalizedEmail, otpCode, expiresAt);

    // Send OTP email
    const emailSent = await emailService.sendOTPEmail(normalizedEmail, otpCode);

    if (!emailSent) {
      console.error('[AUTH] Failed to send OTP email to:', normalizedEmail);
      return res.status(500).json({ 
        error: 'Failed to send login code. Please try again.' 
      });
    }

    console.log(`[AUTH] OTP sent to ${normalizedEmail} (User: ${user.name})`);

    return res.json({ 
      success: true, 
      message: 'Login code sent to your email. Please check your inbox.' 
    });
  } catch (error) {
    console.error('[AUTH] Error requesting OTP:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP code and create session
 */
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  
  // Get client IP for rate limiting
  const ip = getClientIP(req);

  // Rate limiting
  const attempts = loginAttempts.get(ip);
  if (attempts && attempts.count >= MAX_ATTEMPTS && Date.now() < attempts.resetAt) {
    const remainingTime = Math.ceil((attempts.resetAt - Date.now()) / 1000 / 60);
    return res.status(429).json({
      error: 'Too many attempts',
      message: `Please try again in ${remainingTime} minutes`,
    });
  }

  // Validate input
  if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid email or code' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = code.trim();

  console.log('[AUTH] Verify OTP attempt:', {
    email: normalizedEmail,
    code: normalizedCode,
    codeLength: normalizedCode.length,
    codeType: typeof normalizedCode
  });

  try {
    // Find valid, unused OTP code
    const otpRecord = await databaseReadService.getValidOTPCode(normalizedEmail, normalizedCode);

    if (!otpRecord) {
      // Invalid code - increment attempts
      const current = loginAttempts.get(ip) || { count: 0, resetAt: 0 };
      loginAttempts.set(ip, {
        count: current.count + 1,
        resetAt: Date.now() + LOCKOUT_DURATION,
      });

      return res.status(401).json({ 
        error: 'Invalid or expired code',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (current.count + 1))
      });
    }

    const expiresAt = new Date(otpRecord.expiresAt);

    // Check if OTP has expired
    if (expiresAt < new Date()) {
      return res.status(401).json({ 
        error: 'Code has expired. Please request a new one.' 
      });
    }

    // Mark OTP as used
    await databaseWriteService.markOTPAsUsed(otpRecord.id);

    // Get user details including editorFor and centerIds
    const user = await databaseReadService.getUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Determine user role based on simplified system:
    // 1. Admin: isAdmin = true (full system access)
    // 2. Editor: editorFor contains center IDs they can edit
    // 3. Viewer: has access to centers via centerIds (viewer access only)
    let role: 'admin' | 'editor' | 'viewer' = 'viewer';
    
    if (user.isAdmin) {
      role = 'admin';
    } else if (Array.isArray(user.editorFor) && user.editorFor.length > 0) {
      role = 'editor';
    }

    // Success - clear rate limit
    loginAttempts.delete(ip);

    // Create session
    if (req.session) {
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.name;
      req.session.userRole = role;
      req.session.centerIds = user.centerIds;
      req.session.editorFor = user.editorFor;

      // Force session save before sending response
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[AUTH] Session save error:', err);
            reject(err);
          } else {
            console.log('[AUTH] Session saved successfully:', {
              sessionID: req.sessionID,
              userId: req.session.userId,
              userRole: req.session.userRole,
            });
            resolve();
          }
        });
      });
    }

    console.log(`[AUTH] Successful login: ${user.name} (${user.email}) as ${role}`);

    return res.json({ 
      success: true, 
      role,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        centerIds: user.centerIds,
        editorFor: user.editorFor
      }
    });
  } catch (error) {
    console.error('[AUTH] Error verifying OTP:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/auth/logout
 * Destroy session and log out user
 */
router.post('/logout', (req, res) => {
  if (req.session) {
    const userName = req.session.userName || 'Unknown';
    req.session.destroy((err) => {
      if (err) {
        console.error('[AUTH] Error destroying session:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      console.log(`[AUTH] User logged out: ${userName}`);
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } else {
    res.json({ success: true, message: 'No active session' });
  }
});

/**
 * GET /api/auth/admins
 * Get list of all admin users (admin only)
 */
router.get('/admins', async (req, res) => {
  // Check if user is authenticated and is an admin
  if (!req.session?.userId || req.session?.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    const admins = await databaseReadService.getAdminUsers();
    return res.json({ admins });
  } catch (error) {
    console.error('[AUTH] Error fetching admins:', error);
    return res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

/**
 * GET /api/auth/session
 * Check current session status and refresh center data from database
 */
router.get('/session', async (req, res) => {
  if (req.session && req.session.userId && req.session.userEmail) {
    try {
      // Fetch fresh user data including centerIds and editorFor
      const user = await databaseReadService.getUserByEmail(req.session.userEmail);

      if (user) {
        // Update session with fresh data
        req.session.centerIds = user.centerIds;
        req.session.editorFor = user.editorFor;
        
        return res.json({
          authenticated: true,
          user: {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole,
            centerIds: user.centerIds,
            editorFor: user.editorFor
          }
        });
      }
    } catch (error) {
      console.error('[SESSION] Error fetching user data:', error);
    }
    
    // Fallback to session data if query fails
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        name: req.session.userName,
        email: req.session.userEmail,
        role: req.session.userRole,
        centerIds: req.session.centerIds || [],
        editorFor: req.session.editorFor || []
      }
    });
  }
  
  console.log('[AUTH] Session not authenticated');
  return res.json({ authenticated: false });
});

export default router;

