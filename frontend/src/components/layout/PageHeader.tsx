import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  right?: ReactNode;
}

export function PageHeader({ title, right }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-title">{title}</div>
      {right && <div>{right}</div>}
    </div>
  );
}
