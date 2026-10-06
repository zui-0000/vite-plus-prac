import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vite-plus/test";
import App from "./App";

describe("App", () => {
  test("初期表示の場合、カウントが 0 と表示されること", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Count is 0" })).toBeInTheDocument();
  });

  test("ボタンをクリックした場合、カウントが 1 増えること", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Count is 0" }));

    expect(screen.getByRole("button", { name: "Count is 1" })).toBeInTheDocument();
  });
});
