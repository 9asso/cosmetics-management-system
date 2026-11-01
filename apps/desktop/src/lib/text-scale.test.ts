// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultTextScale,
  nextTextScale,
  readTextScale,
  saveTextScale,
  textScaleSteps,
} from "./text-scale";

describe("text size preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.style.removeProperty("--ui-text-scale");
  });

  it("stops at the smallest and largest sizes", () => {
    expect(nextTextScale(textScaleSteps[0]!, -1)).toBe(textScaleSteps[0]);
    expect(nextTextScale(textScaleSteps.at(-1)!, 1)).toBe(textScaleSteps.at(-1));
    expect(nextTextScale(1, 1)).toBe(1.1);
  });

  it("applies the size to the whole document and remembers it", () => {
    saveTextScale(1.2);
    expect(
      document.documentElement.style.getPropertyValue("--ui-text-scale"),
    ).toBe("1.2");
    expect(readTextScale()).toBe(1.2);
  });

  it("ignores an unknown saved value", () => {
    window.localStorage.setItem("onight-text-scale", "9");
    expect(readTextScale()).toBe(defaultTextScale);
  });
});
