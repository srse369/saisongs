import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordDialog } from './PasswordDialog';

describe('PasswordDialog Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_ADMIN_PASSWORD', 'correct-password');
  });

  describe('Rendering and Basic Interaction', () => {
    it('should not render when isOpen is false', () => {
      render(
        <PasswordDialog
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('Admin Authentication')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('Admin Authentication')).toBeInTheDocument();
      expect(screen.getByLabelText('Enter Admin Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should focus password input when dialog opens', () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password');
      expect(passwordInput).toHaveFocus();
    });

    it('should close dialog when Cancel button is clicked', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should close dialog when Escape key is pressed', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Password Validation - Correct Password', () => {
    it('should grant access with correct password', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await userEvent.type(passwordInput, 'correct-password');
      await userEvent.click(submitButton);

      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/incorrect password/i)).not.toBeInTheDocument();
    });

    it('should clear password field after successful authentication', async () => {
      const { rerender } = render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password') as HTMLInputElement;
      await userEvent.type(passwordInput, 'correct-password');
      
      const submitButton = screen.getByRole('button', { name: 'Submit' });
      await userEvent.click(submitButton);

      // Reopen dialog
      rerender(
        <PasswordDialog
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
      rerender(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const newPasswordInput = screen.getByLabelText('Enter Admin Password') as HTMLInputElement;
      expect(newPasswordInput.value).toBe('');
    });
  });

  describe('Password Validation - Incorrect Password', () => {
    it('should show error message for incorrect password', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await userEvent.type(passwordInput, 'wrong-password');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not grant access with incorrect password', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await userEvent.type(passwordInput, 'wrong-password');
      await userEvent.click(submitButton);

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should allow retry after incorrect password', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      // First attempt - wrong password
      await userEvent.type(passwordInput, 'wrong-password');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
      });

      // Clear and try again with correct password
      await userEvent.clear(passwordInput);
      await userEvent.type(passwordInput, 'correct-password');
      await userEvent.click(submitButton);

      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiting', () => {
    it('should lock after 5 failed attempts', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await userEvent.clear(passwordInput);
        await userEvent.type(passwordInput, `wrong-password-${i}`);
        await userEvent.click(submitButton);
      }

      // Should show lockout message
      await waitFor(() => {
        expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
        expect(screen.getByText(/please wait.*minute/i)).toBeInTheDocument();
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should disable input and submit button when locked', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      // Make 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await userEvent.clear(passwordInput);
        await userEvent.type(passwordInput, `wrong-password-${i}`);
        await userEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(passwordInput).toBeDisabled();
      });
    });

    it('should not accept correct password when locked', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password') as HTMLInputElement;
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      // Make 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await userEvent.clear(passwordInput);
        await userEvent.type(passwordInput, `wrong-password-${i}`);
        await userEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
      });

      // Input should be disabled, so we can't type
      expect(passwordInput).toBeDisabled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Submit Button State', () => {
    it('should disable submit button when password is empty', () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByRole('button', { name: 'Submit' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when password is entered', async () => {
      render(
        <PasswordDialog
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const passwordInput = screen.getByLabelText('Enter Admin Password');
      const submitButton = screen.getByRole('button', { name: 'Submit' });

      await userEvent.type(passwordInput, 'any-password');

      expect(submitButton).not.toBeDisabled();
    });
  });
});
