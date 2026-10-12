/**
 * Regression guard: Next renders layouts and pages in parallel, so a check in admin/layout.tsx
 * does not keep a page's data out of the response. Every admin page must check on its own.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : f === "page.tsx" ? [p] : [];
  });
}

describe("admin pages", () => {
  const files = pages(path.join(__dirname, "..", "src", "app", "admin"));
  it("exist", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(`${path.relative(process.cwd(), f)} calls requireOrganizerPage()`, () => {
      expect(readFileSync(f, "utf8")).toMatch(/await requireOrganizerPage\(\)/);
    });
  }
});
