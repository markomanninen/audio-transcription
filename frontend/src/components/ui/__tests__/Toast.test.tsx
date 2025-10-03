import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toast } from '../Toast';

describe('Toast', () => {
  it('renders with title and description', () => {
    render(
      <Toast
        id="test-toast"
        title="Success"
        description="Operation completed successfully"
        variant="success"
      />
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
  });

  it('renders different variants with appropriate icons', () => {
    const { rerender } = render(
      <Toast id="test-toast" variant="success" title="Success" />
    );
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50');

    rerender(<Toast id="test-toast" variant="error" title="Error" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50');

    rerender(<Toast id="test-toast" variant="warning" title="Warning" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-50');

    rerender(<Toast id="test-toast" variant="info" title="Info" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-blue-50');
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Toast id="test-toast" title="Test" onClose={handleClose} />
    );

    await user.click(screen.getByLabelText('Close'));
    expect(handleClose).toHaveBeenCalledWith('test-toast');
  });

  it('auto-closes after duration', async () => {
    const handleClose = vi.fn();

    render(
      <Toast id="test-toast" title="Test" onClose={handleClose} duration={100} />
    );

    await waitFor(() => expect(handleClose).toHaveBeenCalledWith('test-toast'), {
      timeout: 200,
    });
  });

  it('renders action button when action is provided', async () => {
    const handleAction = vi.fn();
    const user = userEvent.setup();

    render(
      <Toast
        id="test-toast"
        title="Test"
        action={{ label: 'Retry', onClick: handleAction }}
      />
    );

    expect(screen.getByText('Retry')).toBeInTheDocument();
    await user.click(screen.getByText('Retry'));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('has correct accessibility attributes', () => {
    render(
      <Toast id="test-toast" title="Test" />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });
});
