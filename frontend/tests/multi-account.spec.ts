import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("nhiều tài khoản đăng ký và giữ dữ liệu riêng", async ({ page }) => {
  test.skip(
    process.env.E2E_ISOLATED_DATA !== "1",
    "Only run against the runner's temporary database",
  );
  const isolatedBackend = process.env.E2E_BACKEND_URL;
  if (isolatedBackend) {
    // Forward real auth requests to a dedicated temporary backend, leaving the developer's database untouched.
    await page.route("**/api/auth/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const response = await route.fetch({
        url: new URL(path, isolatedBackend).toString(),
      });
      await route.fulfill({ response });
    });
    await page.addInitScript(
      ({ backend }) => {
        const NativeSocket = window.WebSocket;
        const endpoint = new URL("/ws", backend);
        endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
        window.WebSocket = class extends NativeSocket {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(
              new URL(String(url), location.href).pathname === "/ws"
                ? endpoint.toString()
                : url,
              protocols,
            );
          }
        };
      },
      { backend: isolatedBackend },
    );
  }
  const first = `account-${randomUUID()}`;
  const second = `account-${randomUUID()}`;
  const password = randomUUID();
  async function register(username: string) {
    await page.goto("/register");
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Đăng ký thành công" }),
    ).toBeVisible();
  }
  async function login(username: string) {
    await page.goto("/login");
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill(username);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-connection",
      "connected",
    );
    await expect(page.getByTestId("account-name")).toHaveText(username);
    await expect(
      page.getByRole("button", { name: "Sao lưu dữ liệu", exact: true }),
    ).toHaveCount(0);
  }
  async function logout() {
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
  await register(first);
  await register(second);
  await login(first);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Đơn vị", exact: true })
    .click();
  await page.getByRole("button", { name: "Thêm đơn vị", exact: true }).click();
  await page.getByLabel("Tên tổ chức *").fill("Dữ liệu riêng của A");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Quản lí khoản thu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Thêm khoản phải thu", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Đơn vị *", exact: true })
    .selectOption({ label: "Dữ liệu riêng của A" });
  await page
    .getByLabel("Nội dung công việc *")
    .fill("Công việc của tài khoản A");
  await page.getByLabel("Số lượng *").fill("2");
  await page.getByLabel("Đơn giá (đồng) *").fill("12345");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Công việc của tài khoản A" }),
  ).toBeVisible();
  await logout();
  await login(second);
  await expect(page.locator(".metric").first()).toContainText("0 khoản");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Quản lí khoản thu", exact: true })
    .click();
  await expect(
    page.getByText("Không có khoản phải thu phù hợp.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Công việc của tài khoản A" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Đơn vị", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Dữ liệu riêng của A" }),
  ).toHaveCount(0);
  await logout();
  await login(first);
  await expect(page.locator(".metric").first()).toContainText("24.690");
  await logout();
  await page.unrouteAll({ behavior: "wait" });
});
