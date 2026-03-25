import { renderHook } from "@testing-library/react";
import { useAnchorNavigation } from "./useAnchorNavigation";

describe("useAnchorNavigation", () => {
  describe("Scrolling", () => {
    it("should return scrollToHeading function", () => {
      const mockDiv = document.createElement("div");
      const { result } = renderHook(() => useAnchorNavigation(mockDiv));

      expect(result.current.scrollToHeading).toBeDefined();
      expect(typeof result.current.scrollToHeading).toBe("function");
    });

    it("should scroll to heading by id", () => {
      const mockDiv = document.createElement("div");
      const headingElement = document.createElement("div");
      headingElement.id = "heading-intro";

      const scrollIntoViewMock = jest.fn();
      headingElement.scrollIntoView = scrollIntoViewMock;

      mockDiv.appendChild(headingElement);

      const { result } = renderHook(() => useAnchorNavigation(mockDiv));
      result.current.scrollToHeading("heading-intro");

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    it("should scroll to heading by data-heading-id", () => {
      const mockDiv = document.createElement("div");
      const headingElement = document.createElement("div");
      headingElement.setAttribute("data-heading-id", "heading-section");

      const scrollIntoViewMock = jest.fn();
      headingElement.scrollIntoView = scrollIntoViewMock;

      mockDiv.appendChild(headingElement);

      const { result } = renderHook(() => useAnchorNavigation(mockDiv));
      result.current.scrollToHeading("heading-section");

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });

    it("should prioritize id over data-heading-id", () => {
      const mockDiv = document.createElement("div");

      const elementWithId = document.createElement("div");
      elementWithId.id = "heading-intro";
      const scrollIntoViewMock1 = jest.fn();
      elementWithId.scrollIntoView = scrollIntoViewMock1;

      const elementWithData = document.createElement("div");
      elementWithData.setAttribute("data-heading-id", "heading-intro");
      const scrollIntoViewMock2 = jest.fn();
      elementWithData.scrollIntoView = scrollIntoViewMock2;

      mockDiv.appendChild(elementWithId);
      mockDiv.appendChild(elementWithData);

      const { result } = renderHook(() => useAnchorNavigation(mockDiv));
      result.current.scrollToHeading("heading-intro");

      // Should call the first one (by id)
      expect(scrollIntoViewMock1).toHaveBeenCalled();
      expect(scrollIntoViewMock2).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle null editor element", () => {
      const { result } = renderHook(() => useAnchorNavigation(null));

      // Should not throw
      expect(() => result.current.scrollToHeading("heading-intro")).not.toThrow();
    });

    it("should handle non-existent heading", () => {
      const mockDiv = document.createElement("div");
      const { result } = renderHook(() => useAnchorNavigation(mockDiv));

      // Should not throw
      expect(() => result.current.scrollToHeading("non-existent")).not.toThrow();
    });

    it("should handle multiple headings", () => {
      const mockDiv = document.createElement("div");

      const heading1 = document.createElement("div");
      heading1.id = "heading-1";
      const scroll1 = jest.fn();
      heading1.scrollIntoView = scroll1;

      const heading2 = document.createElement("div");
      heading2.id = "heading-2";
      const scroll2 = jest.fn();
      heading2.scrollIntoView = scroll2;

      mockDiv.appendChild(heading1);
      mockDiv.appendChild(heading2);

      const { result } = renderHook(() => useAnchorNavigation(mockDiv));

      result.current.scrollToHeading("heading-1");
      result.current.scrollToHeading("heading-2");

      expect(scroll1).toHaveBeenCalled();
      expect(scroll2).toHaveBeenCalled();
    });

    it("should work with deeply nested elements", () => {
      const mockDiv = document.createElement("div");
      const wrapper = document.createElement("div");
      const headingElement = document.createElement("div");
      headingElement.id = "heading-nested";

      const scrollMock = jest.fn();
      headingElement.scrollIntoView = scrollMock;

      wrapper.appendChild(headingElement);
      mockDiv.appendChild(wrapper);

      const { result } = renderHook(() => useAnchorNavigation(mockDiv));
      result.current.scrollToHeading("heading-nested");

      expect(scrollMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });
  });
});
