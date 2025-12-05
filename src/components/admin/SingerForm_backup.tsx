import React, { useState, useEffect, useMemo } from 'react';
import type { Singer, CreateSingerInput } from '../../types';
import { CenterMultiSelect } from '../common/CenterMultiSelect';

interface SingerFormProps {
  singer?: Singer | null;
  onSubmit: (input: CreateSingerInput) => Promise<void>;
  onCancel: () => void;
  onUnsavedChangesRef?: React.MutableRefObject<(() => boolean) | null>;
}

export const SingerForm: React.FC<SingerFormProps> = ({ singer, onSubmit, onCancel, onUnsavedChangesRef }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Boy' | 'Girl' | 'Other' | ''>('');
  const [centerIds, setCenterIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!singer;
  
  // Track if form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (singer) {
      // Edit mode - compare with original values
      const originalCenterIds = singer.center_ids || [];
      const centerIdsChanged = JSON.stringify(centerIds.slice().sort()) !== JSON.stringify(originalCenterIds.slice().sort());
      return name !== singer.name || gender !== (singer.gender || '') || centerIdsChanged;
    } else {
      // Create mode - check if any field has content
      return !!(name.trim() || gender || centerIds.length > 0);
    }
  }, [singer, name, gender, centerIds]);

  // Expose hasUnsavedChanges check to parent via ref
  useEffect(() => {
    if (onUnsavedChangesRef) {
      onUnsavedChangesRef.current = () => hasUnsavedChanges;
    }
    return () => {
      if (onUnsavedChangesRef) {
        onUnsavedChangesRef.current = null;
      }
    };
  }, [hasUnsavedChanges, onUnsavedChangesRef]);

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!confirmed) {
        return;
      }
    }
    onCancel();
  };

  useEffect(() => {
    if (singer) {
      setName(singer.name);
      setGender(singer.gender || '');
      setCenterIds(singer.center_ids || []);
    } else {
      setName('');
      setGender('');
      setCenterIds([]);
    }
    setErrors({});
  }, [singer]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Singer name is required';
    } else if (name.length > 255) {
      newErrors.name = 'Singer name must be 255 characters or less';
    }

    if (!gender) {
      newErrors.gender = 'Gender is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        gender: gender as 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other',
        center_ids: centerIds.length > 0 ? centerIds : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label htmlFor="singer-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Singer Name <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="singer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          placeholder="Enter singer name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="singer-gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Gender <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <select
          id="singer-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.gender ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          disabled={isSubmitting}
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Boy">Boy</option>
          <option value="Girl">Girl</option>
          <option value="Other">Other</option>
        </select>
        {errors.gender && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.gender}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Centers
        </label>
        <CenterMultiSelect
          selectedCenterIds={centerIds}
          onChange={setCenterIds}
          disabled={isSubmitting}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Leave empty to make this singer accessible to all centers
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 w-full sm:w-auto"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Singer' : 'Create Singer'}
        </button>
      </div>
    </form>
  );
};
