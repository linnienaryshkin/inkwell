import { useEffect, useState, useCallback } from "react";
import type { Heading } from "./useHeadingExtraction";

/**
 * Tracks which heading is currently visible in the editor and returns its ID.
 * Updates in real-time as the user scrolls.
 */
export function useScrollTracking(
  headings: Heading[],
  editorElement: HTMLElement | null
): string | null {
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);

  const updateCurrentHeading = useCallback(() => {
    if (!editorElement) return;

    // Get all heading elements in the editor
    const allHeadings = flattenHeadings(headings);
    if (!allHeadings.length) {
      setCurrentHeadingId(null);
      return;
    }

    // Find the heading closest to the top of the visible area
    let closestHeading = allHeadings[0];
    let closestDistance = Infinity;

    for (const heading of allHeadings) {
      // Try to find the element with the heading's ID
      const element =
        editorElement.querySelector(`[id="${heading.id}"]`) ||
        editorElement.querySelector(`[data-heading-id="${heading.id}"]`);

      if (!element) continue;

      const rect = element.getBoundingClientRect();
      const distance = Math.abs(rect.top - 100); // 100px threshold from top

      // Update if this heading is closer to the viewport top
      if (distance < closestDistance && rect.bottom > 0) {
        closestDistance = distance;
        closestHeading = heading;
      }
    }

    setCurrentHeadingId(closestHeading.id);
  }, [headings, editorElement]);

  useEffect(() => {
    if (!editorElement) return;

    const handleScroll = () => {
      updateCurrentHeading();
    };

    editorElement.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    updateCurrentHeading();

    return () => {
      editorElement.removeEventListener("scroll", handleScroll);
    };
  }, [editorElement, updateCurrentHeading]);

  return currentHeadingId;
}

/**
 * Flattens hierarchical headings into a flat array for iteration
 */
function flattenHeadings(headings: Heading[]): Heading[] {
  const result: Heading[] = [];

  function traverse(items: Heading[]) {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        traverse(item.children);
      }
    }
  }

  traverse(headings);
  return result;
}
