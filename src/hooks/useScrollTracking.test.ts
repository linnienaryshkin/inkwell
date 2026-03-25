import { renderHook } from "@testing-library/react";
import { useScrollTracking } from "./useScrollTracking";
import type { Heading } from "./useHeadingExtraction";

describe("useScrollTracking", () => {
  const mockHeadings: Heading[] = [
    {
      id: "heading-intro",
      level: 1,
      text: "Introduction",
      lineNumber: 0,
      children: [
        {
          id: "heading-getting-started",
          level: 2,
          text: "Getting Started",
          lineNumber: 2,
        },
        {
          id: "heading-installation",
          level: 2,
          text: "Installation",
          lineNumber: 5,
        },
      ],
    },
    {
      id: "heading-advanced",
      level: 1,
      text: "Advanced",
      lineNumber: 8,
      children: [
        {
          id: "heading-optimization",
          level: 2,
          text: "Optimization",
          lineNumber: 10,
        },
      ],
    },
  ];

  describe("Initial state", () => {
    it("should return null when no editor element is provided", () => {
      const { result } = renderHook(() => useScrollTracking(mockHeadings, null));
      expect(result.current).toBeNull();
    });

    it("should return null when no headings are provided", () => {
      const mockDiv = document.createElement("div");
      const { result } = renderHook(() => useScrollTracking([], mockDiv));
      expect(result.current).toBeNull();
    });

    it("should return first heading when editor element is provided", () => {
      const mockDiv = document.createElement("div");
      const headingElement = document.createElement("div");
      headingElement.id = "heading-intro";
      mockDiv.appendChild(headingElement);

      const { result } = renderHook(() => useScrollTracking(mockHeadings, mockDiv));
      expect(result.current).toBe("heading-intro");
    });
  });

  describe("Heading detection", () => {
    it("should detect heading by id attribute", () => {
      const mockDiv = document.createElement("div");

      // Create heading elements for all headings
      const intro = document.createElement("div");
      intro.id = "heading-intro";
      mockDiv.appendChild(intro);

      const started = document.createElement("div");
      started.id = "heading-getting-started";
      mockDiv.appendChild(started);

      const { result } = renderHook(() => useScrollTracking(mockHeadings, mockDiv));
      // Should find the first one (intro)
      expect(result.current).toBe("heading-intro");
    });

    it("should detect heading by data-heading-id attribute", () => {
      const mockDiv = document.createElement("div");

      const intro = document.createElement("div");
      intro.id = "heading-intro";
      mockDiv.appendChild(intro);

      const install = document.createElement("div");
      install.setAttribute("data-heading-id", "heading-installation");
      mockDiv.appendChild(install);

      const { result } = renderHook(() => useScrollTracking(mockHeadings, mockDiv));
      // Should find intro by id
      expect(result.current).toBe("heading-intro");
    });
  });

  describe("Cleanup", () => {
    it("should remove scroll listener on unmount", () => {
      const mockDiv = document.createElement("div");
      const headingElement = document.createElement("div");
      headingElement.id = "heading-intro";
      mockDiv.appendChild(headingElement);

      const removeEventListenerSpy = jest.spyOn(mockDiv, "removeEventListener");

      const { unmount } = renderHook(() => useScrollTracking(mockHeadings, mockDiv));
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe("Edge cases", () => {
    it("should handle null headings gracefully", () => {
      const mockDiv = document.createElement("div");
      const { result } = renderHook(() => useScrollTracking([], mockDiv));
      expect(result.current).toBeNull();
    });

    it("should handle missing heading elements", () => {
      const mockDiv = document.createElement("div");
      // No heading elements added to DOM

      const { result } = renderHook(() => useScrollTracking(mockHeadings, mockDiv));
      // Should return first heading ID even if element not found
      expect(result.current).toBe("heading-intro");
    });

    it("should handle single heading", () => {
      const mockDiv = document.createElement("div");
      const heading = document.createElement("div");
      heading.id = "heading-intro";
      mockDiv.appendChild(heading);

      const { result } = renderHook(() => useScrollTracking(mockHeadings, mockDiv));
      expect(result.current).toBe("heading-intro");
    });

    it("should handle headings with no children", () => {
      const simpleHeadings: Heading[] = [
        {
          id: "heading-simple",
          level: 1,
          text: "Simple",
          lineNumber: 0,
        },
      ];

      const mockDiv = document.createElement("div");
      const heading = document.createElement("div");
      heading.id = "heading-simple";
      mockDiv.appendChild(heading);

      const { result } = renderHook(() => useScrollTracking(simpleHeadings, mockDiv));
      expect(result.current).toBe("heading-simple");
    });
  });
});
