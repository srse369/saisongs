import React, { useState, useEffect } from 'react';
import type { NamedSession, CreateNamedSessionInput, UpdateNamedSessionInput } from '../../types';
import { CenterMultiSelect } from '../common/CenterMultiSelect';

interface NamedSessionFormProps {
  session?: NamedSession;
  onSubmit: (data: CreateNamedSessionInput | UpdateNamedSessionInput) => Promise<void>;
  onCancel: () => void;
}

export const NamedSessionForm: React.FC<NamedSessionFormProps> = ({
  session,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [centerIds, setCenterIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      setName(session.name);
      setDescription(session.description || '');
      setCenterIds(session.centerIds || []);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await onSubmit({ 
        name, 
        description: description || undefined,
        centerIds: centerIds.length > 0 ? centerIds : undefined
      });
      // Reset form
      setName('');
      setDescription('');
      setCenterIds([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="session-name" className="block text-sm font-medium text-gray-700 mb-1">
          Session Name *
        </label>
        <input
          id="session-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter session name"
          disabled={submitting}
        />
      </div>

      <div>
        <label htmlFor="session-description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="session-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description"
          disabled={submitting}
        />
      </div>

      <div>
        <CenterMultiSelect
          selectedCenterIds={centerIds}
          onChange={setCenterIds}
          label="Restrict to Centers (optional)"
          disabled={submitting}
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave empty to make accessible to all users, or select specific centers to restrict access
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : session ? 'Update Session' : 'Create Session'}
        </button>
      </div>
    </form>
  );
};

