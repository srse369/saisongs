import express from 'express';
import { databaseService } from '../services/DatabaseService.js';

const router = express.Router();
const db = databaseService;

interface FeedbackSubmission {
  feedback: string;
  category: 'bug' | 'feature' | 'improvement' | 'question' | 'other';
  email: string;
  userAgent?: string;
  url?: string;
  timestamp?: string;
}

interface Feedback extends FeedbackSubmission {
  id: string;
  status: 'new' | 'in-progress' | 'resolved' | 'closed';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Submit feedback
router.post('/', async (req, res) => {
  try {
    const { feedback, category, email, userAgent, url } = req.body;

    if (!feedback || feedback.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback cannot be empty' });
    }

    if (!category || !['bug', 'feature', 'improvement', 'question', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (!email || email.trim().length === 0) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Get IP address from request
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Insert into database
    await db.query(
      `INSERT INTO feedback (category, feedback, email, ip_address, user_agent, url, status)
       VALUES (:1, :2, :3, :4, :5, :6, 'new')`,
      [category, feedback.trim(), email.trim(), ipAddress, userAgent || req.get('user-agent') || null, url || null]
    );

    // Log feedback for debugging
    console.log('📝 Feedback received:', {
      category: category,
      feedback: feedback.substring(0, 100) + (feedback.length > 100 ? '...' : ''),
      email: email,
      ip: ipAddress,
    });

    res.status(201).json({ 
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get all feedback (admin only)
router.get('/', async (req, res) => {
  try {
    const { status, category, limit = 100, offset = 0 } = req.query;

    let query = `SELECT 
      RAWTOHEX(id) as id,
      category,
      feedback,
      email,
      ip_address as ip_address,
      user_agent as user_agent,
      url,
      status,
      admin_notes as admin_notes,
      created_at,
      updated_at
      FROM feedback
      WHERE 1=1`;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND status = :${paramIndex++}`;
      params.push(status);
    }

    if (category) {
      query += ` AND category = :${paramIndex++}`;
      params.push(category);
    }

    query += ' ORDER BY created_at DESC';
    query += ` OFFSET :${paramIndex++} ROWS FETCH NEXT :${paramIndex++} ROWS ONLY`;
    
    params.push(Number(offset));
    params.push(Number(limit));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM feedback WHERE 1=1';
    const countParams: any[] = [];
    let countIndex = 1;
    
    if (status) {
      countQuery += ` AND status = :${countIndex++}`;
      countParams.push(status);
    }
    
    if (category) {
      countQuery += ` AND category = :${countIndex++}`;
      countParams.push(category);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = (countResult[0] as any)?.TOTAL || 0;

    // Helper function to safely convert Oracle objects to plain values
    const safeValue = (val: any): any => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'object' && val.constructor && val.constructor.name === 'ConnectDescription') {
        // Oracle TIMESTAMP object - try to extract the date value
        return val.toDate ? val.toDate().toISOString() : new Date(val).toISOString();
      }
      if (Buffer.isBuffer(val)) return val.toString('hex');
      // Handle Oracle CLOB - read the string value
      if (typeof val === 'object' && typeof val.toString === 'function') {
        const str = val.toString();
        // If toString returns [object Object], try to access common CLOB properties
        if (str === '[object Object]') {
          return val.val || val.value || String(val);
        }
        return str;
      }
      if (typeof val === 'object') {
        // Try to serialize, if it fails return string representation
        try {
          JSON.stringify(val);
          return val;
        } catch {
          return String(val);
        }
      }
      return val;
    };

    // Map to camelCase and safely serialize all values
    const feedback = result.map((row: any) => ({
      id: safeValue(row.ID),
      category: safeValue(row.CATEGORY),
      feedback: safeValue(row.FEEDBACK),
      email: safeValue(row.EMAIL),
      ipAddress: safeValue(row.IP_ADDRESS),
      userAgent: safeValue(row.USER_AGENT),
      url: safeValue(row.URL),
      status: safeValue(row.STATUS),
      adminNotes: safeValue(row.ADMIN_NOTES),
      createdAt: safeValue(row.CREATED_AT),
      updatedAt: safeValue(row.UPDATED_AT)
    }));

    res.json({
      total: total,
      feedback: feedback,
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Update feedback status and admin notes
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (status && !['new', 'in-progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = :${paramIndex++}`);
      params.push(status);
    }

    if (adminNotes !== undefined) {
      updates.push(`admin_notes = :${paramIndex++}`);
      params.push(adminNotes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const query = `UPDATE feedback SET ${updates.join(', ')} WHERE id = HEXTORAW(:${paramIndex})`;
    params.push(id);

    await db.query(query, params);

    res.json({ message: 'Feedback updated successfully' });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Delete feedback
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      'DELETE FROM feedback WHERE id = HEXTORAW(:1)',
      [id]
    );

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
