import * as React from 'react';

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', className = '', ...props }, ref) => {
        const baseStyles =
            'px-4 py-2 rounded focus:outline-none focus:ring';
        const variantStyles =
            variant === 'primary'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

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