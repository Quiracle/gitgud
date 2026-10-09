import type { MouseEvent, ReactNode } from "react";

interface AppLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onNavigate: (path: string) => void;
}

export function AppLink({ href, children, className, onNavigate }: AppLinkProps) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  }

  return (
    <a href={href} onClick={follow} className={className}>
      {children}
    </a>
  );
}
