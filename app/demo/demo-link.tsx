'use client';
import { useDemo, type DemoView } from './demo-provider';
export function DemoLink({
  children,
  view = 'setup',
  className,
  onOpen,
}: {
  children: React.ReactNode;
  view?: DemoView;
  className?: string;
  onOpen?: () => void;
}) {
  const { openDemo } = useDemo();
  return (
    <button
      type="button"
      className={className ?? 'demo-inline-link'}
      onClick={() => {
        onOpen?.();
        openDemo(view);
      }}
    >
      {children}
    </button>
  );
}
