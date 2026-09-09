"use client";
import { useDemo, type DemoView } from "./demo-provider";
export function DemoLink({
  children,
  view = "setup",
  className,
}: {
  children: React.ReactNode;
  view?: DemoView;
  className?: string;
}) {
  const { openDemo } = useDemo();
  return (
    <button
      type="button"
      className={className ?? "demo-inline-link"}
      onClick={() => openDemo(view)}
    >
      {children}
    </button>
  );
}
