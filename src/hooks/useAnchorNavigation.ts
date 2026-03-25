import { useCallback } from "react";

/**
 * Provides a function to scroll to a specific heading by its ID.
 * This hook is used by the TOC tab to navigate when clicking heading links.
 */
export function useAnchorNavigation(editorElement: HTMLElement | null) {
  const scrollToHeading = useCallback(
    (headingId: string) => {
      if (!editorElement) return;

      // Try to find the element by ID first
      let element = editorElement.querySelector(`[id="${headingId}"]`);

      // Fall back to data-heading-id attribute
      if (!element) {
        element = editorElement.querySelector(`[data-heading-id="${headingId}"]`);
      }

      if (!element) return;

      // Scroll to the element with smooth behavior
      // Use scrollIntoView for Monaco editor compatibility
      (element as HTMLElement).scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [editorElement]
  );

  return { scrollToHeading };
}
