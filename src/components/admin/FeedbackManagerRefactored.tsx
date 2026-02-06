import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { feedbackService, type Feedback } from '../../services/FeedbackService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../common/Modal';
import { RefreshIcon, type MobileAction } from '../common';
import { BaseManager } from './BaseManager';
import { useBaseManager } from '../../hooks/useBaseManager';
import { globalEventBus } from '../../utils/globalEventBus';

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

interface FeedbackManagerProps {
  isActive?: boolean;
}

export const FeedbackManagerRefactored: React.FC<FeedbackManagerProps> = ({ isActive = true }) => {
  const location = useLocation();
  const { isAdmin, userEmail } = useAuth();
  const toast = useToast();
  
  // Use base manager hook for common functionality
  const baseManager = useBaseManager({
    resourceName: 'feedback',
    isActive,
    // onDataRefresh will be set after loadFeedback is defined
  });

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

  const loadFeedback = useCallback(async () => {
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
  }, [filter, toast]);

  // Subscribe to global data refresh events and call loadFeedback when relevant
  useEffect(() => {
    const unsubscribe = globalEventBus.on('dataRefreshNeeded', (detail) => {
      if (detail.resource === 'feedback' || detail.resource === 'all') {
        loadFeedback();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadFeedback]);

  useEffect(() => {
    // Only fetch feedback when tab is active and user is admin (only if not already loaded)
    if (isAdmin && isActive && feedback.length === 0) {
      loadFeedback();
    }
  }, [isAdmin, isActive, loadFeedback, feedback.length]);

  useEffect(() => {
    let unsubscribes: (() => void)[] = [];
    const unsubscribeFeedbackSubmitted = globalEventBus.on('feedbackSubmitted', (_detail) => {
      loadFeedback();
    });
    unsubscribes.push(unsubscribeFeedbackSubmitted);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [loadFeedback]);

  const handleViewDetails = (item: Feedback) => {
    setSelectedFeedback(item);
    setAdminNotes(`\n-----------------------------------------\nUpdated by: ${item.updatedBy}\nUpdated at: ${item.updatedAt}\nAdmin Notes:\n${item.adminNotes || ''}`);
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
        updatedBy: userEmail || 'Unknown',
      });

      toast.success('Feedback updated successfully');
      setDetailsModalOpen(false);
      await loadFeedback();
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error('Failed to update feedback');
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      console.error('Cannot delete feedback: ID is missing', { id });
      toast.error('Cannot delete feedback: ID is missing');
      return;
    }

    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      await feedbackService.deleteFeedback(id);
      toast.success('Feedback deleted successfully');
      await loadFeedback();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete feedback';
      toast.error(errorMessage.includes('not found') || errorMessage.includes('already deleted')
        ? 'Feedback not found or already deleted'
        : 'Failed to delete feedback');
    }
  };

  if (!isAdmin) {
    return (
      <BaseManager
        isActive={isActive}
        isMobile={baseManager.isMobile}
        title="Feedback"
        subtitle="You do not have permission to view this page."
      >
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            You do not have permission to view this page.
          </p>
        </div>
      </BaseManager>
    );
  }

  if (loading) {
    return (
      <BaseManager
        isActive={isActive}
        isMobile={baseManager.isMobile}
        title="Feedback"
        subtitle="Loading feedback..."
        loading={loading}
      >
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </BaseManager>
    );
  }

  // Mobile actions for bottom bar
  const mobileActions: MobileAction[] = [
    {
      label: 'Refresh',
      icon: 'fas fa-sync-alt',
      onClick: () => {
        loadFeedback();
      },
      variant: 'secondary',
      disabled: loading,
    },
  ];

  // Header actions content
  const headerActions = (
    <div className={`flex flex-wrap gap-2 sm:gap-4 items-center ${baseManager.isMobile ? 'mt-2' : 'mt-4'}`}>
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
        <button
          type="button"
          onClick={() => loadFeedback()}
          disabled={loading}
          title="Refresh feedback list"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <RefreshIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>
    </div>
  );

  return (
    <BaseManager
      isActive={isActive}
      isMobile={baseManager.isMobile}
      showScrollToTop={baseManager.showScrollToTop}
      listContainerStyle={baseManager.listContainerStyle}
      listContainerRef={baseManager.listContainerRef}
      headerRef={baseManager.headerRef}
      title="Feedback"
      subtitle={`${total} total submission${total !== 1 ? 's' : ''}`}
      helpHref="/help#overview"
      headerActions={headerActions}
      mobileActions={mobileActions}
      onScrollToTop={baseManager.scrollToTop}
      loading={loading}
    >
      <div className={baseManager.isMobile ? 'px-1.5 sm:px-6 lg:px-8' : ''}>
        {/* Feedback List */}
        {feedback.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No feedback found</p>
          </div>
        ) : (
          <div className="space-y-0 md:space-y-3">
            {feedback.map((item, index) => {
              const isSelected = selectedFeedbackId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    // On mobile, toggle selection on row click
                    if (baseManager.isMobile) {
                      setSelectedFeedbackId(isSelected ? null : item.id);
                    }
                  }}
                  className={`bg-white dark:bg-gray-800 p-2 md:p-4 transition-all duration-200 ${baseManager.isMobile
                    ? `cursor-pointer ${index > 0 ? 'border-t border-gray-300 dark:border-gray-600' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`
                    : `border rounded-lg shadow-md hover:shadow-lg ${isSelected
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                      : 'border-gray-200 dark:border-gray-700'
                      }`
                    }`}
                >
                  <div className="flex flex-col gap-1.5 md:gap-3">
                    {/* Content Section */}
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
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status || 'new'] || STATUS_COLORS['new']}`}>
                            {(item.status || 'new').replace('-', ' ')}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewClick(item);
                          }}
                          title="View feedback details"
                          className="flex-shrink-0 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
                        >
                          <i className="fas fa-eye text-base"></i>
                        </button>
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

                    {/* Actions - On separate line below horizontal separator on desktop */}
                    <div className={`flex flex-wrap items-center justify-start gap-1.5 sm:gap-2 pt-1 md:pt-3 md:border-t md:border-gray-200 md:dark:border-gray-700 ${baseManager.isMobile && !isSelected ? 'hidden' : ''}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleViewDetails(item)}
                        title="Edit feedback status and admin notes"
                        className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                      >
                        <i className="fas fa-edit text-lg text-blue-600 dark:text-blue-400"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center sm:justify-start gap-2 p-2.5 sm:p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg sm:rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                      >
                        <i className="fas fa-trash text-lg text-red-600 dark:text-red-400"></i>
                        <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                {isPreviewMode ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg">
                    {newStatus.replace('-', ' ')}
                  </p>
                ) : (
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
                )}
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Feedback
              </label>
              <p className={`text-sm bg-gray-50 dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap ${isPreviewMode
                ? 'text-gray-500 dark:text-gray-400'
                : 'text-gray-900 dark:text-white'
                }`}>
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

              {(selectedFeedback.updatedBy || selectedFeedback.updatedAt) && (
                <div className="sm:col-span-2">
                  {selectedFeedback.updatedBy && (
                    <div className="mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Updated By
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedFeedback.updatedBy}
                      </p>
                    </div>
                  )}
                  {selectedFeedback.updatedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Updated At
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedFeedback.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
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
              {isPreviewMode ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap">
                  {adminNotes || 'No admin notes'}
                </p>
              ) : (
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  placeholder="Add internal notes about this feedback..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
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
    </BaseManager>
  );
};

export default FeedbackManagerRefactored;
