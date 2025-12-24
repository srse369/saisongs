import React, { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext';

interface FeedbackDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'question' | 'other';

type CaptchaOperation = '+' | '-' | '*';

const CATEGORIES: { value: FeedbackCategory; label: string; icon: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: '🐛' },
  { value: 'feature', label: 'Feature Request', icon: '✨' },
  { value: 'improvement', label: 'Improvement', icon: '🚀' },
  { value: 'question', label: 'Question', icon: '❓' },
  { value: 'other', label: 'Other', icon: '💬' },
];

export const FeedbackDrawer: React.FC<FeedbackDrawerProps> = ({ isOpen, onClose }) => {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState({ num1: 0, num2: 0, operation: '+' as CaptchaOperation });
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const toast = useToast();

  // Generate new captcha when drawer opens
  useEffect(() => {
    if (isOpen) {
      generateCaptcha();
    }
    // Don't clear form fields when drawer opens
  }, [isOpen]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const generateCaptcha = () => {
    const operations: CaptchaOperation[] = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let num1: number;
    let num2: number;
    
    switch (operation) {
      case '+':
        num1 = Math.floor(Math.random() * 30) + 10;
        num2 = Math.floor(Math.random() * 30) + 10;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 40) + 20; // 20-59
        num2 = Math.floor(Math.random() * 20) + 1;  // 1-20, ensure positive result
        break;
      case '*':
        num1 = Math.floor(Math.random() * 10) + 2;  // 2-11
        num2 = Math.floor(Math.random() * 10) + 2;  // 2-11
        break;
    }
    
    setCaptchaQuestion({ num1, num2, operation });
    setCaptchaAnswer('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      toast.error('Please enter your feedback');
      return;
    }

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate captcha
    let expectedAnswer: number;
    switch (captchaQuestion.operation) {
      case '+':
        expectedAnswer = captchaQuestion.num1 + captchaQuestion.num2;
        break;
      case '-':
        expectedAnswer = captchaQuestion.num1 - captchaQuestion.num2;
        break;
      case '*':
        expectedAnswer = captchaQuestion.num1 * captchaQuestion.num2;
        break;
    }
    
    if (parseInt(captchaAnswer) !== expectedAnswer) {
      toast.error('Incorrect captcha answer. Please try again.');
      generateCaptcha();
      return;
    }

    setIsSubmitting(true);
    try {
      // Send feedback to backend
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback: feedback.trim(),
          category,
          email: email.trim(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      toast.success('Thank you for your feedback!');
      setFeedback('');
      setEmail('');
      setCategory('other');
      setCaptchaAnswer('');
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop - 50% dimming overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer - slides in from right */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4 text-white flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send Feedback</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100 transition-colors focus:outline-none"
            aria-label="Close"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {/* Category Selection */}
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <div className="relative">
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent appearance-none cursor-pointer"
                  required
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <i className="fas fa-chevron-down text-lg text-gray-400"></i>
                </div>
              </div>
            </div>

            {/* Feedback Text */}
            <div>
              <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Feedback
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what you think, report issues, or suggest improvements... please indicate the center you are from and provide as many details as possible"
                className="w-full h-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                We'll use this to respond to your feedback
              </p>
            </div>

            {/* Captcha */}
            <div>
              <label htmlFor="captcha" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Security Check *
              </label>
              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <div className="text-lg font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-center">
                    {captchaQuestion.num1} {captchaQuestion.operation} {captchaQuestion.num2} = ?
                  </div>
                </div>
                <input
                  id="captcha"
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Answer"
                  className="w-24 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent text-center font-semibold"
                  required
                />
                <button
                  type="button"
                  onClick={generateCaptcha}
                  className="p-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Generate new question"
                >
                  <i className="fas fa-sync text-lg"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 space-y-3">
            <button
              type="submit"
              disabled={isSubmitting || !feedback.trim() || !email.trim() || !captchaAnswer.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
