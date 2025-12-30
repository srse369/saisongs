import React, { useState, useEffect } from 'react';
import { feedbackService, type Feedback } from '../../services/FeedbackService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../common/Modal';
import { RefreshIcon, Tooltip, MobileBottomActionBar, type MobileAction } from '../common';

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  bug: { label: 'Bug Report', icon: '🐛' },
  feature: { label: 'Feature Request', icon: '✨' },
  improvement: { label: 'Improvement', icon: '🚀' },
  question: { label: 'Question', icon: '❓' },
  other: { label: 'Other', icon: '💬' },
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'in-progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export const FeedbackManager: React.FC = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string; category?: string }>({});
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState<Feedback['status']>('new');
  const [total, setTotal] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadFeedback();
    }
  }, [isAdmin, filter]);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const response = await feedbackService.getFeedback(filter);
      setFeedback(response.feedback);
      setTotal(response.total);
    } catch (error) {
      console.error('Error loading feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (item: Feedback) => {
    setSelectedFeedback(item);
    setAdminNotes(item.adminNotes || '');
    setNewStatus(item.status);
    setIsPreviewMode(false);
    setDetailsModalOpen(true);
  };

  const handlePreviewClick = (item: Feedback) => {
    setSelectedFeedback(item);
    setAdminNotes(item.adminNotes || '');
    setNewStatus(item.status);
    setIsPreviewMode(true);
    setDetailsModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedFeedback) return;

    try {
      await feedbackService.updateFeedback(selectedFeedback.id, {
        status: newStatus,
        adminNotes: adminNotes.trim() || undefined,
      });

      toast.success('Feedback updated successfully');
      setDetailsModalOpen(false);
      loadFeedback();
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error('Failed to update feedback');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      await feedbackService.deleteFeedback(id);
      toast.success('Feedback deleted successfully');
      loadFeedback();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      toast.error('Failed to delete feedback');
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => loadFeedback(),
      variant: 'secondary',
      disabled: loading,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Feedback</h1>
            <a
              href="/help#overview"
              className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
              title="View help documentation"
            >
              <i className="fas fa-question-circle text-lg sm:text-xl"></i>
            </a>
          </div>
          <p className="hidden sm:block mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} total submission{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
        <select
          value={filter.status || ''}
          onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
          className="flex-1 sm:flex-none min-w-[140px] px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={filter.category || ''}
          onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
          className="flex-1 sm:flex-none min-w-[140px] px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="bug">🐛 Bug Report</option>
          <option value="feature">✨ Feature Request</option>
          <option value="improvement">🚀 Improvement</option>
          <option value="question">❓ Question</option>
          <option value="other">💬 Other</option>
        </select>

        {/* Desktop refresh button - hidden on mobile */}
        <div className="hidden md:block">
          <Tooltip content="Refresh feedback list">
            <button
              type="button"
              onClick={() => loadFeedback()}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Feedback List */}
      {feedback.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No feedback found</p>
        </div>
      ) : (
        <div className="space-y-2 md:space-y-4">
          {feedback.map((item) => {
            const isSelected = selectedFeedbackId === item.id;
            return (
            <div
              key={item.id}
              onClick={() => {
                // On mobile, toggle selection on row click
                if (isMobile) {
                  setSelectedFeedbackId(isSelected ? null : item.id);
                }
              }}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-2 md:p-4 hover:shadow-md transition-shadow ${
                isSelected && isMobile
                  ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                  : 'border-gray-200 dark:border-gray-700'
              } ${isMobile ? 'cursor-pointer' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 md:gap-4">
                <div className="flex-1 min-w-0">
                  {/* Category and Status */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {CATEGORY_LABELS[item.category]?.icon || '💬'}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {CATEGORY_LABELS[item.category]?.label || 'Other'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                        {item.status.replace('-', ' ')}
                      </span>
                    </div>
                    <Tooltip content="View feedback details">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewClick(item);
                        }}
                        className="flex-shrink-0 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                      >
                        <i className="fas fa-eye text-base"></i>
                      </button>
                    </Tooltip>
                  </div>

                  {/* Feedback Text */}
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
                    {item.feedback}
                  </p>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>✉️ {item.email}</span>
                    {item.ipAddress && <span>🌐 {item.ipAddress}</span>}
                    <span>📅 {new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.url && <span>🔗 {new URL(item.url).pathname}</span>}
                  </div>
                </div>

                {/* Actions - Hidden on mobile until row is selected */}
                <div className={`flex gap-1.5 sm:gap-2 sm:flex-col ${isMobile && !isSelected ? 'hidden' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleViewDetails(item)}
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg sm:rounded-md transition-colors"
                  >
                    <i className="fas fa-eye text-lg"></i>
                    <span className="hidden sm:inline">View Details</span>
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg sm:rounded-md transition-colors"
                  >
                    <i className="fas fa-trash text-lg"></i>
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setIsPreviewMode(false);
        }}
        title={isPreviewMode ? 'View Feedback' : 'Feedback Details'}
      >
        {selectedFeedback && (
          <div className="space-y-4">
            {/* Category and Status */}
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {CATEGORY_LABELS[selectedFeedback.category]?.icon || '💬'}
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {CATEGORY_LABELS[selectedFeedback.category]?.label || 'Other'}
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Feedback['status'])}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">New</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Feedback
              </label>
              <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap">
                {selectedFeedback.feedback}
              </p>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{selectedFeedback.email}</p>
              </div>

              {selectedFeedback.ipAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IP Address
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedFeedback.ipAddress}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Submitted
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {new Date(selectedFeedback.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* URL */}
            {selectedFeedback.url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Page URL
                </label>
                <a
                  href={selectedFeedback.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {selectedFeedback.url}
                </a>
              </div>
            )}

            {/* User Agent */}
            {selectedFeedback.userAgent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User Agent
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                  {selectedFeedback.userAgent}
                </p>
              </div>
            )}

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                placeholder="Add internal notes about this feedback..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setDetailsModalOpen(false);
                  setIsPreviewMode(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {isPreviewMode ? 'Close' : 'Cancel'}
              </button>
              {!isPreviewMode && (
                <button
                  onClick={handleUpdateStatus}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Mobile Bottom Action Bar */}
      <MobileBottomActionBar
        actions={mobileActions}
      />
    </div>
  );
};

export default FeedbackManager;
