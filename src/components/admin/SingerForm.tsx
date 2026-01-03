import React, { useState, useEffect, useMemo } from 'react';
import type { Singer, CreateSingerInput } from '../../types';
import { CenterMultiSelect } from '../common/CenterMultiSelect';
import { useAuth } from '../../contexts/AuthContext';

interface SingerFormProps {
  singer?: Singer | null;
  onSubmit: (input: CreateSingerInput, adminFields?: { isAdmin: boolean; editorFor: number[] }) => Promise<void>;
  onCancel: () => void;
  onUnsavedChangesRef?: React.MutableRefObject<(() => boolean) | null>;
  readOnly?: boolean;
}

export const SingerForm: React.FC<SingerFormProps> = ({ singer, onSubmit, onCancel, onUnsavedChangesRef, readOnly = false }) => {
  const { isAdmin, isEditor, editorFor, userId } = useAuth();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Boy' | 'Girl' | 'Other' | ''>('');
  const [email, setEmail] = useState('');
  const [centerIds, setCenterIds] = useState<number[]>([]);
  const [singerIsAdmin, setSingerIsAdmin] = useState(false);
  const [editorForCenters, setEditorForCenters] = useState<number[]>([]);
  const [originalCenterIds, setOriginalCenterIds] = useState<number[]>([]); // Track original centers
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSelectApplied, setAutoSelectApplied] = useState(false);

  const isEditMode = !!singer;
  
  // Calculate read-only centers (centers user cannot manage)
  const readOnlyCenterIds = useMemo(() => {
    if (isAdmin || !isEditMode) return [];
    // Centers that are in originalCenterIds but NOT in editorFor
    return originalCenterIds.filter(id => !editorFor.includes(id));
  }, [isAdmin, isEditMode, originalCenterIds, editorFor]);
  
  // Check if user has any editor access to this singer's centers
  const hasEditorAccess = useMemo(() => {
    if (isAdmin) return true;
    if (!isEditMode) return true; // Always allow creating new singers
    // Allow users to edit their own profile
    if (singer?.id === userId) return true;
    const singerCenters = singer?.centerIds || [];
    // User must have editor access to at least one of the singer's centers
    return singerCenters.some(centerId => editorFor.includes(centerId));
  }, [isAdmin, isEditMode, singer, editorFor, userId]);
  
  // Determine if all fields should be disabled (no access at all, or read-only mode)
  const isFormDisabled = readOnly || (isEditMode && !hasEditorAccess);
  
  // Track if form has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (singer) {
      // Edit mode - compare with original values
      const originalCenterIds = singer.centerIds || [];
      const originalEditorFor = singer.editorFor || [];
      const centerIdsChanged = JSON.stringify(centerIds.slice().sort()) !== JSON.stringify(originalCenterIds.slice().sort());
      const editorForChanged = JSON.stringify(editorForCenters.slice().sort()) !== JSON.stringify(originalEditorFor.slice().sort());
      return name !== singer.name || 
             gender !== (singer.gender || '') || 
             email !== (singer.email || '') ||
             centerIdsChanged ||
             singerIsAdmin !== (singer.isAdmin || false) ||
             editorForChanged;
    } else {
      // Create mode - check if any field has content
      return !!(name.trim() || gender || email.trim() || centerIds.length > 0);
    }
  }, [singer, name, gender, email, centerIds, singerIsAdmin, editorForCenters]);

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

  // Handle cancel - parent handles unsaved changes check
  const handleCancel = () => {
    onCancel();
  };

  useEffect(() => {
    if (singer) {
      // If user is not admin/editor and trying to view someone else's profile, show blank form
      if (!isAdmin && !isEditor && singer.id !== userId) {
        setName('');
        setGender('');
        setEmail('');
        setCenterIds([]);
        setOriginalCenterIds([]);
        setSingerIsAdmin(false);
        setEditorForCenters([]);
        setAutoSelectApplied(true);
        return;
      }
      
      setName(singer.name);
      setGender(singer.gender || '');
      setEmail(singer.email || '');
      const singerCenters = singer.centerIds || [];
      setCenterIds(singerCenters);
      setOriginalCenterIds(singerCenters); // Store original centers
      setSingerIsAdmin(singer.isAdmin || false);
      setEditorForCenters(singer.editorFor || []);
      setAutoSelectApplied(true); // Already have centers from singer
    } else {
      setName('');
      setGender('');
      setEmail('');
      setCenterIds([]);
      setOriginalCenterIds([]);
      setSingerIsAdmin(false);
      setEditorForCenters([]);
      setAutoSelectApplied(false); // Reset for new singer
    }
    setErrors({});
  }, [singer, isAdmin, isEditor, userId]);

  // Handle centers loaded callback - no auto-selection
  const handleCentersLoaded = (loadedCenters: Array<{id: number; name: string}>) => {
    // Auto-selection is disabled - users must explicitly select centers
  };

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

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'Invalid email format';
      }
    }

    // All users must select at least one center (admins and non-admins)
    if (centerIds.length === 0) {
      newErrors.centerIds = 'At least one center must be selected';
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
      const input: CreateSingerInput = {
        name: name.trim(),
        gender: gender as 'Male' | 'Female' | 'Boy' | 'Girl' | 'Other',
        email: email.trim() || undefined,
        centerIds: centerIds.length > 0 ? centerIds : undefined,
      };
      
      // If current user is admin, pass admin fields (both create and edit)
      const adminFields = isAdmin ? {
        isAdmin: singerIsAdmin,
        editorFor: editorForCenters
      } : undefined;
      
      await onSubmit(input, adminFields);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      {isFormDisabled && !readOnly && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ You do not have editor access to any of this singer's centers. All fields are read-only.
          </p>
        </div>
      )}
      <div>
        <label htmlFor="singer-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Singer Name <span className="text-red-500 dark:text-red-400">*</span>
          <span 
            title="Full name of the singer"
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <input
          id="singer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 placeholder:text-gray-400 placeholder:italic dark:placeholder:text-gray-500 ${
            errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          placeholder="Enter singer name"
          disabled={isSubmitting || isFormDisabled}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="singer-gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Gender <span className="text-red-500 dark:text-red-400">*</span>
          <span 
            title="Gender affects pitch range recommendations and display colors"
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <select
          id="singer-gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 ${
            errors.gender ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          disabled={isSubmitting || isFormDisabled}
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
        <label htmlFor="singer-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Email {isEditMode ? '(Required for Admin/Editor/Viewer)' : '(Optional)'}
          <span 
            title={isEditMode ? "Valid email is required to grant admin privileges or editor permissions" : "Contact email for notifications and communication"}
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <input
          id="singer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 placeholder:text-gray-400 placeholder:italic dark:placeholder:text-gray-500 ${
            errors.email ? 'border-red-500 dark:border-red-400' : 'border-gray-300'
          }`}
          placeholder="e.g. singer@example.com"
          disabled={isSubmitting || isFormDisabled}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
        )}
        {isEditMode && !email.trim() && (
          <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ Email required to grant admin privileges or editor or viewer permissions
          </p>
        )}
      </div>

      {(isEditMode || isAdmin) && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Is Admin {isAdmin ? '' : '(Read-only)'}
              <span 
                title={!email.trim() ? "Email required to grant admin privileges - admins have full access to all centers" : "Admins have full access to all centers and can manage all features"}
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
              >
                <i className="fas fa-info-circle text-xs"></i>
              </span>
            </label>
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={singerIsAdmin}
                    onChange={(e) => setSingerIsAdmin(e.target.checked)}
                    disabled={isSubmitting || !email.trim() || isFormDisabled}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Grant admin privileges (full system access)
                  </span>
                </label>
              </div>
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md opacity-60 cursor-not-allowed">
                <span className={`${singer?.isAdmin ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {singer?.isAdmin ? 'Yes - Full system access' : 'No'}
                </span>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Admin status grants full access to all centers and features.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Editor For Centers {isAdmin ? '' : '(Read-only)'}
              <span 
                title={!email.trim() ? "Email required to grant editor permissions" : "Centers where this user has editing permissions for songs, singers, and pitches"}
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
              >
                <i className="fas fa-info-circle text-xs"></i>
              </span>
            </label>
            <CenterMultiSelect
              selectedCenterIds={editorForCenters}
              onChange={isAdmin ? setEditorForCenters : () => {}} 
              disabled={!isAdmin || isSubmitting || !email.trim() || isFormDisabled}
              editableOnly={false}
              label=""
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {isAdmin 
                ? 'Select centers this user can edit. Users are automatically associated with centers they can edit.'
                : 'Centers this user can edit (managed in Centers tab). Users are automatically associated with centers they can edit.'}
            </p>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Singer's Centers <span className="text-red-500 dark:text-red-400">*</span>
          <span 
            title="Centers this singer is associated with - at least one center is required"
            className="ml-1 text-gray-400 dark:text-gray-500 cursor-help"
          >
            <i className="fas fa-info-circle text-xs"></i>
          </span>
        </label>
        <CenterMultiSelect
          selectedCenterIds={centerIds}
          onChange={setCenterIds}
          disabled={isSubmitting || isFormDisabled}
          editableOnly={true}
          onCentersLoaded={handleCentersLoaded}
          readOnlyCenterIds={readOnlyCenterIds}
          label=""
        />
        {errors.centerIds && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.centerIds}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {isAdmin 
            ? 'Select which centers this singer belongs to (at least one required)'
            : readOnlyCenterIds.length > 0
              ? 'You can add/remove centers you manage. Centers marked "read-only" are managed by other centers.'
              : 'Select centers for this singer (you can only select centers you manage)'}
        </p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          title={isFormDisabled ? "Close form" : "Discard changes and close the form"}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 w-full sm:w-auto"
        >
          {isFormDisabled ? 'Close' : 'Cancel'}
        </button>
        {!isFormDisabled && !readOnly && (
          <button
            type="submit"
            disabled={isSubmitting}
            title={isEditMode ? "Save changes to this singer's profile" : "Create a new singer with these details"}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Singer' : 'Create Singer'}
          </button>
        )}
      </div>
    </form>
  );
};
