import * as React from 'react';

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: 'primary' | 'secondary';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ variant = 'primary', className = '', ...props }, ref) => {
        const baseStyles =
            'px-4 py-2 rounded focus:outline-none focus:ring';
        const variantStyles =
            variant === 'primary'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

        return (
            <input
                ref={ref}
                className={`${baseStyles} ${variantStyles} ${className}`}
                {...props}
            />
        );
    }
);

Input.displayName = 'Button';

export default Input;