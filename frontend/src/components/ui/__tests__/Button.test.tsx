import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders different variants', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    expect(container.firstChild).toHaveClass('bg-red-600');
  });

  it('shows loading spinner when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Button</Button>);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders different sizes', () => {
    const { container, rerender } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toHaveClass('h-8');

    rerender(<Button size="lg">Large</Button>);
    expect(container.firstChild).toHaveClass('h-12');
  });
});
