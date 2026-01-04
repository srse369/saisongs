import express from 'express';
import { cacheService } from '../services/CacheService.js';

const router = express.Router();

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

    // Insert into database via cache service
    await cacheService.createFeedback({
      feedback: feedback.trim(),
      category,
      email: email.trim(),
      ipAddress: ipAddress?.toString(),
      userAgent: userAgent || req.get('user-agent') || undefined,
      url: url || undefined
    });

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

    // Get all feedback from cache
    let result = await cacheService.getAllFeedback();

    // Apply filters
    if (status) {
      result = result.filter(f => f.status === status);
    }

    if (category) {
      result = result.filter(f => f.category === category);
    }

    const total = result.length;

    // Apply pagination
    const startIdx = Number(offset);
    const endIdx = startIdx + Number(limit);
    result = result.slice(startIdx, endIdx);

    res.json({
      total: total,
      feedback: result,
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

    const updates: any = {};

    if (status) {
      updates.status = status;
    }

    if (adminNotes !== undefined) {
      updates.adminNotes = adminNotes.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await cacheService.updateFeedback(id, updates);

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

    if (!id) {
      return res.status(400).json({ error: 'Feedback ID is required' });
    }

    await cacheService.deleteFeedback(id);

    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete feedback';
    
    // Check if it's a "not found" error
    if (errorMessage.includes('not found') || errorMessage.includes('already deleted')) {
      return res.status(404).json({ error: errorMessage });
    }
    
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
