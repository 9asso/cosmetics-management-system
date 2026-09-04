import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { recipes, ui } from "./ui";

describe("Tailwind recipes", () => {
  it("merges component overrides without legacy CSS", () => {
    const classes = ui("panel data-panel");
    expect(classes.split(" ")).toContain("p-0");
    expect(classes.split(" ")).not.toContain("p-4");
    expect(ui("primary-button")).toContain("bg-linear-to-r");
    expect(ui('primary-button')).toContain('from-brand to-brand-secondary');
    expect(ui("avatar")).toContain("to-brand-secondary");
    expect(ui("overline").split(' ')).not.toContain('overline');
  });
  it("provides all dynamically selected tone recipes", () => {
    for (const tone of ["good", "warn", "bad", "neutral"])
      expect(recipes[`status-${tone}`]).toBeTruthy();
    for (const tone of ["ink", "green", "gold", "rose"])
      expect(recipes[`metric-${tone}`]).toBeTruthy();
  });
  it("keeps the stylesheet limited to Tailwind imports and theme tokens", () => {
    const css = readFileSync(resolve("src/styles.css"), "utf8");
    expect(css).toContain('@import "tailwindcss"');
    expect(css).not.toMatch(/\.[a-z][\w-]*\s*\{/);
    expect(css).not.toContain("@apply");
    expect(css).not.toMatch(/#677b74|#263b33/);
  });
  it("covers every semantic class passed to ui in the dashboard", () => {
    const files = [
      "src/App.tsx",
      ...["src/pages", "src/components"].flatMap((dir) =>
        readdirSync(dir)
          .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
          .map((file) => `${dir}/${file}`),
      ),
    ];
    for (const file of files) {
      for (const match of readFileSync(file, "utf8").matchAll(
        /ui\(["']([\w -]+)["']\)/g,
      )) {
        for (const token of match[1]!.split(" "))
          expect(
            token in recipes || token === "text-sm",
            `${file}: ${token}`,
          ).toBe(true);
      }
    }
  });
});
