import React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { spinnerVariants } from './spinner-variants';

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string;
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size, label = 'Loading...', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        className={cn('inline-block', className)}
        {...props}
      >
        <div className={cn(spinnerVariants({ size }))} />
        <span className="sr-only">{label}</span>
      </div>
    );
  }
);
Spinner.displayName = 'Spinner';

export { Spinner };
export default Spinner;
