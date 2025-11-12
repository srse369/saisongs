import React, { useState, useEffect } from 'react';
import type { Singer, CreateSingerInput } from '../../types';

interface SingerFormProps {
  singer?: Singer | null;
  onSubmit: (input: CreateSingerInput) => Promise<void>;
  onCancel: () => void;
}

export const SingerForm: React.FC<SingerFormProps> = ({ singer, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!singer;

  useEffect(() => {
    if (singer) {
      setName(singer.name);
    } else {
      setName('');
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
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="singer-name" className="block text-sm font-medium text-gray-700 mb-1">
          Singer Name <span className="text-red-500">*</span>
        </label>
        <input
          id="singer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter singer name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : isEditMode ? 'Update Singer' : 'Create Singer'}
        </button>
      </div>
    </form>
  );
};
