import * as React from 'react';

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', className = '', ...props }, ref) => {
        const baseStyles =
            'px-5 py-2.5 rounded-full text-sm font-semibold transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';
        const variantStyles =
            variant === 'primary'
                ? 'bg-inverse text-on-inverse hover:bg-accent hover:text-on-accent'
                : 'bg-card text-ink border border-line hover:bg-subtle';

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variantStyles} ${className}`}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export default Button;
