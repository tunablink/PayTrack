import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("đăng ký tài khoản và giữ form mở cho tài khoản tiếp theo", async ({
  page,
}, testInfo) => {
  // Isolated UI test; real account creation, hashing and concurrency are covered by backend tests.
  const available = true;
  let submitted = 0;
  await page.route("**/api/auth/registration", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ available }),
    }),
  );
  await page.route("**/api/auth/register", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.username).toBe("new-owner");
    expect(body.password).toBe(body.password_confirmation);
    submitted++;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ registered: true }),
    });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Đăng ký tài khoản" }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng ký", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Tên đăng nhập", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `../docs/screenshots/register-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const password = randomUUID();
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("  new-owner  ");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page
    .getByLabel("Xác nhận mật khẩu", { exact: true })
    .fill(randomUUID());
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Mật khẩu xác nhận không khớp",
  );
  expect(submitted).toBe(0);
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng ký thành công" }),
  ).toBeVisible();
  expect(submitted).toBe(1);
  await page.getByRole("link", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Đăng ký tài khoản" }),
  ).toBeVisible();
  await page.goto("/register");
  await expect(
    page.getByRole("button", { name: "Đăng ký", exact: true }),
  ).toBeVisible();
});

test("tên đăng nhập trùng hiển thị lỗi và giữ form để sửa", async ({ page }) => {
  await page.route("**/api/auth/registration", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ available: true }),
    }),
  );
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        code: "USERNAME_TAKEN",
        message: "Tên đăng nhập đã được sử dụng. Vui lòng chọn tên khác.",
      }),
    }),
  );
  await page.goto("/register");
  const password = randomUUID();
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("new-owner");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Tên đăng nhập đã được sử dụng",
  );
  await expect(
    page.getByRole("button", { name: "Đăng ký", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Đăng ký thành công" }),
  ).toHaveCount(0);
});
