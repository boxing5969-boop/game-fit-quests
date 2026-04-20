import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppPageProps extends HTMLAttributes<HTMLDivElement> {
  /** Header slot rendered above the scrollable content. */
  header?: ReactNode;
  /** Content. Use PageHeader + sections. */
  children: ReactNode;
  /** Remove the default bottom padding if the page hides the tab bar. */
  noBottomPad?: boolean;
}

/**
 * Mobile app shell — dark background, max-width=lg mobile container,
 * reserves space for the bottom tab bar. Pair with PageHeader.
 */
export const AppPage = ({
  header,
  children,
  className,
  noBottomPad = false,
  ...rest
}: AppPageProps) => (
  <div className={cn("app-shell", className)} {...rest}>
    {header}
    <main
      className={cn(
        "mx-auto w-full max-w-lg px-5 pt-4",
        noBottomPad ? "pb-4" : "pb-24",
      )}
    >
      {children}
    </main>
  </div>
);

export default AppPage;
