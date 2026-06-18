import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'accent' | 'danger' | 'ghost' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'accent', fullWidth = false, className = '', children, ...props }: ButtonProps) {
  const cls = [
    'btn',
    `btn-${variant}`,
    fullWidth ? 'btn-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
