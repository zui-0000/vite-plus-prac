import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vite-plus/test";

// Testing Library only auto-cleans up when `afterEach` is a global, and test APIs here are imported explicitly.
afterEach(() => {
  cleanup();
});
