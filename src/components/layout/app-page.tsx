import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

interface AppPageProps extends HTMLAttributes<HTMLElement> {
  width?: 'default' | 'wide';
}

interface AppPageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}

interface AppSectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

const pageWidths = {
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
};

const AppPage = forwardRef<HTMLElement, AppPageProps>(
  ({ className = '', width = 'default', ...props }, ref) => (
    <main
      ref={ref}
      className={`min-h-screen min-w-0 px-4 py-5 pb-12 sm:px-6 sm:py-6 ${pageWidths[width]} mx-auto ${className}`}
      {...props}
    />
  ),
);
AppPage.displayName = 'AppPage';

function AppPageHeader({
  title,
  subtitle,
  status,
  actions,
  className = '',
  ...props
}: AppPageHeaderProps) {
  return (
    <header
      className={`mb-6 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start ${className}`}
      {...props}
    >
      <div className="min-w-0">
        <h1 className="t-app-title m-0 break-words">{title}</h1>
        {subtitle ? <div className="t-app-meta mt-1 min-w-0 break-words">{subtitle}</div> : null}
        {status ? <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">{status}</div> : null}
      </div>
      {actions ? (
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

function AppPageActions({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end ${className}`}
      {...props}
    />
  );
}

function AppSection({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`min-w-0 space-y-4 ${className}`} {...props} />;
}

function AppSectionHeader({
  title,
  description,
  actions,
  className = '',
  ...props
}: AppSectionHeaderProps) {
  return (
    <div className={`grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${className}`} {...props}>
      <div className="min-w-0">
        <h2 className="t-app-section m-0 break-words">{title}</h2>
        {description ? <p className="t-app-meta mt-1 m-0 break-words">{description}</p> : null}
      </div>
      {actions ? <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">{actions}</div> : null}
    </div>
  );
}

export { AppPage, AppPageActions, AppPageHeader, AppSection, AppSectionHeader };
