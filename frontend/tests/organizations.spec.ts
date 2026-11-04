import { test, expect } from "@playwright/test";
import type { Organization } from "../lib/types";

test("đơn vị có đủ tám cột và lưu các trường mới khi thêm sửa xem", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1600, height: 1000 });
  // UI fixtures only. Persistence, constraints and migration are tested against real temporary SQLite in pytest.
  let organizations: Organization[] = [];
  let writes = 0;
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        username: "organization-test",
        is_admin: false,
      }),
    }),
  );
  await page.routeWebSocket("**/ws", (socket) =>
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      let data: unknown;
      if (message.action === "organization.list") data = organizations;
      else if (message.action === "organization.create") {
        writes++;
        const record = {
          ...message.payload,
          id: 1,
          version: 1,
          created_at: "2026-11-04T00:00:00Z",
          updated_at: "2026-11-04T00:00:00Z",
        } as Organization;
        organizations = [record];
        data = record;
      } else if (message.action === "organization.update") {
        writes++;
        const record = {
          ...organizations[0],
          ...message.payload,
          version: organizations[0].version + 1,
        } as Organization;
        organizations = [record];
        data = record;
      } else if (message.action === "payment.list")
        data = { items: [], total: 0, page: 1, page_size: 20 };
      else if (message.action === "system.ping") data = { pong: true };
      else
        data = {
          totals: {
            total: 0,
            paid: 0,
            unpaid: 0,
            count: 0,
            paid_count: 0,
            unpaid_count: 0,
          },
          organizations: [],
          periods: [],
        };
      socket.send(
        JSON.stringify({ requestId: message.requestId, success: true, data }),
      );
    }),
  );
  await page.goto("/organizations");
  await expect(page.getByRole("columnheader")).toHaveText([
    "Tên tổ chức",
    "Loại hình",
    "Người đại diện",
    "Thông tin liên hệ",
    "Địa chỉ",
    "Ghi chú",
    "Trạng thái",
    "Thao tác",
  ]);
  await page.getByRole("button", { name: "Thêm đơn vị", exact: true }).click();
  await page.getByLabel("Tên tổ chức *").fill("Công ty Kiểm thử");
  await page
    .getByLabel("Loại hình", { exact: true })
    .fill("Doanh nghiệp công nghệ");
  await page
    .getByLabel("Người đại diện", { exact: true })
    .fill("Nguyễn Văn An");
  await page.getByLabel("Email", { exact: true }).fill("contact@example.com");
  await page
    .getByLabel("Số điện thoại", { exact: true })
    .fill("+84 (28) 1234-5678");
  await page
    .getByLabel("Địa chỉ", { exact: true })
    .fill("123 Nguyễn Văn A, TP.HCM");
  await page
    .getByLabel("Ghi chú", { exact: true })
    .fill("Đối soát vào cuối tháng");
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("INACTIVE");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: "Công ty Kiểm thử" });
  await expect(row.getByRole("cell")).toHaveCount(8);
  await expect(row).toContainText("Doanh nghiệp công nghệ");
  await expect(row).toContainText("Nguyễn Văn An");
  await expect(row).toContainText("Ngừng hoạt động");
  await expect(
    row.getByRole("link", { name: "contact@example.com" }),
  ).toHaveAttribute("href", "mailto:contact@example.com");
  await expect(
    row.getByRole("link", { name: "+84 (28) 1234-5678", exact: true }),
  ).toHaveAttribute("href", "tel:+842812345678");
  expect(writes).toBe(1);
  const typeFilter = page.getByRole("combobox", { name: "Lọc loại hình", exact: true });
  const statusFilter = page.getByRole("combobox", { name: "Lọc trạng thái", exact: true });
  const search = page.getByRole("textbox", { name: "Tìm đơn vị", exact: true });
  await typeFilter.selectOption("Doanh nghiệp công nghệ");
  await statusFilter.selectOption("ACTIVE");
  await expect(row).toHaveCount(0);
  await expect(page.getByText("Chưa có đơn vị phù hợp.", { exact: false })).toBeVisible();
  await statusFilter.selectOption("INACTIVE");
  await expect(row).toBeVisible();
  await search.fill("không tìm thấy");
  await expect(row).toHaveCount(0);
  await search.fill("KIỂM THỬ");
  await expect(row).toBeVisible();
  const searchWidth = await search.locator("..").evaluate(element => element.getBoundingClientRect().width);
  expect(searchWidth).toBeGreaterThan((await typeFilter.boundingBox())!.width);
  expect(searchWidth).toBeGreaterThan((await statusFilter.boundingBox())!.width);
  await search.fill("");
  await typeFilter.selectOption("");
  await statusFilter.selectOption("");
  await page.screenshot({
    path: `../docs/screenshots/organizations-details-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await row.getByRole("button", { name: /^Xem / }).click();
  await expect(page.getByRole("dialog")).toContainText("Nguyễn Văn An");
  await expect(page.getByRole("dialog")).toContainText(
    "123 Nguyễn Văn A, TP.HCM",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(page.getByLabel("Loại hình", { exact: true })).toHaveValue(
    "Doanh nghiệp công nghệ",
  );
  await expect(page.getByLabel("Người đại diện", { exact: true })).toHaveValue(
    "Nguyễn Văn An",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "contact@example.com",
  );
  await page.getByLabel("Người đại diện", { exact: true }).fill("Trần Bình");
  await page.getByLabel("Email", { exact: true }).fill("");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("");
  await page
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("ACTIVE");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toContainText("Trần Bình");
  await expect(row).toContainText("Đang hoạt động");
  await expect(row.getByRole("cell").nth(3)).toHaveText("—");
  await page.reload();
  await expect(row).toContainText("Trần Bình");
  await expect(row).toContainText("Đối soát vào cuối tháng");
  expect(writes).toBe(2);
});
