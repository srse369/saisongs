import express from 'express';
import { databaseService } from '../services/DatabaseService.js';
import { emailService } from '../services/EmailService.js';

const router = express.Router();
const db = databaseService;

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
  db.query('BEGIN cleanup_expired_otp_codes; END;').catch(err => {
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
    const users = await db.query<any>(
      'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(:1)',
      [normalizedEmail]
    );

    if (users.length === 0) {
      // User not found - inform them to contact their center
      console.log(`[AUTH] OTP requested for non-existent email: ${normalizedEmail}`);
      return res.status(404).json({ 
        error: 'Email not found',
        message: 'Please contact your nearest center to get access.' 
      });
    }

    const user = users[0];

    // Generate OTP code
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

    // Store OTP in database
    await db.query<any>(
      `INSERT INTO otp_codes (email, code, expires_at) 
       VALUES (:1, :2, :3)`,
      [normalizedEmail, otpCode, expiresAt]
    );

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
    // Find valid, unused OTP code (used = 0 for Oracle NUMBER)
    const otpRecords = await db.query<any>(
      `SELECT id, code, email, expires_at, used FROM otp_codes 
       WHERE email = :1 AND code = :2 AND used = 0 
       ORDER BY created_at DESC`,
      [normalizedEmail, normalizedCode]
    );

    // Only take the most recent one
    const recentOtp = otpRecords.length > 0 ? [otpRecords[0]] : [];

    if (recentOtp.length === 0) {
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

    const otpRecord = recentOtp[0];
    const expiresAt = new Date(otpRecord.expires_at || otpRecord.EXPIRES_AT); // Oracle returns uppercase column names

    // Check if OTP has expired
    if (expiresAt < new Date()) {
      return res.status(401).json({ 
        error: 'Code has expired. Please request a new one.' 
      });
    }

    // Mark OTP as used (1 = true for Oracle NUMBER)
    await db.query<any>(
      'UPDATE otp_codes SET used = 1 WHERE id = :1',
      [otpRecord.id || otpRecord.ID]
    );

    // Get user details including editor_for and center_ids
    const users = await db.query<any>(
      'SELECT id, name, email, is_admin, editor_for, center_ids FROM users WHERE LOWER(email) = LOWER(:1)',
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];

    // Convert user ID for comparison
    const userIdValue = user.id || user.ID;
    let userId: number;
    
    if (Buffer.isBuffer(userIdValue)) {
      if (userIdValue.length >= 8) {
        userId = Number(userIdValue.readBigUInt64LE(0));
      } else if (userIdValue.length >= 4) {
        userId = userIdValue.readUInt32LE(0);
      } else {
        userId = parseInt(userIdValue.toString('utf8'));
      }
    } else {
      userId = userIdValue;
    }

    // Determine user role based on simplified system:
    // 1. Admin: is_admin = 1 (full system access)
    // 2. Editor: editor_for contains center IDs they can edit
    // 3. Viewer: has access to centers via center_ids (viewer access only)
    let role: 'admin' | 'editor' | 'viewer' = 'viewer';
    let editorFor: number[] = [];
    let centerIds: number[] = [];
    
    // Check if user is an admin (is_admin = 1)
    const isAdmin = (user.is_admin || user.IS_ADMIN) === 1;
    
    if (isAdmin) {
      role = 'admin';
    } else {
      // Parse editor_for JSON to check if user is an editor
      const editorForJson = user.editor_for || user.EDITOR_FOR;
      if (editorForJson) {
        try {
          editorFor = JSON.parse(editorForJson);
          // If user has any centers they can edit, they're an editor
          role = Array.isArray(editorFor) && editorFor.length > 0 ? 'editor' : 'viewer';
        } catch (e) {
          console.error('[AUTH] Error parsing editor_for:', e);
          // If parsing fails, default to viewer
          role = 'viewer';
        }
      }
      
      // Parse center_ids for viewer access
      const centerIdsJson = user.center_ids || user.CENTER_IDS;
      if (centerIdsJson) {
        try {
          centerIds = JSON.parse(centerIdsJson);
        } catch (e) {
          console.error('[AUTH] Error parsing center_ids:', e);
        }
      }
    }

    // Success - clear rate limit
    loginAttempts.delete(ip);

    // Create session
    if (req.session) {
      req.session.userId = userId;
      req.session.userEmail = user.email || user.EMAIL;
      req.session.userName = user.name || user.NAME;
      req.session.userRole = role;
      req.session.centerIds = centerIds;
      req.session.editorFor = editorFor;

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

    console.log(`[AUTH] Successful login: ${user.name || user.NAME} (${user.email || user.EMAIL}) as ${role}`);

    return res.json({ 
      success: true, 
      role,
      user: {
        id: user.id || user.ID,
        name: user.name || user.NAME,
        email: user.email || user.EMAIL,
        centerIds: centerIds,
        editorFor: editorFor
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
 * GET /api/auth/session
 * Check current session status and refresh center data from database
 */
router.get('/session', async (req, res) => {
  if (req.session && req.session.userId && req.session.userEmail) {
    try {
      // Fetch fresh user data including centerIds and editorFor
      const users = await db.query<any>(
        'SELECT id, name, email, is_admin, editor_for, center_ids FROM users WHERE LOWER(email) = LOWER(:1)',
        [req.session.userEmail]
      );

      if (users.length > 0) {
        const user = users[0];
        
        // Parse centerIds and editorFor from database
        let centerIds: number[] = [];
        let editorFor: number[] = [];
        
        try {
          const centerIdsJson = user.center_ids || user.CENTER_IDS;
          if (centerIdsJson) {
            centerIds = JSON.parse(centerIdsJson);
          }
        } catch (e) {
          console.error('[SESSION] Error parsing center_ids:', e);
        }
        
        try {
          const editorForJson = user.editor_for || user.EDITOR_FOR;
          if (editorForJson) {
            editorFor = JSON.parse(editorForJson);
          }
        } catch (e) {
          console.error('[SESSION] Error parsing editor_for:', e);
        }
        
        // Update session with fresh data
        req.session.centerIds = centerIds;
        req.session.editorFor = editorFor;
        
        return res.json({
          authenticated: true,
          user: {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail,
            role: req.session.userRole,
            centerIds: centerIds,
            editorFor: editorFor
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

