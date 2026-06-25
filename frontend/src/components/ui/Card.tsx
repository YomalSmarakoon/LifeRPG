import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div className={`card ${className}`} {...props}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  );
}
