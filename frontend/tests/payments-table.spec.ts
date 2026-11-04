import { test, expect } from "@playwright/test";

test("quản lí khoản thu: thứ tự tám cột và hạn thanh toán riêng", async ({ page }, testInfo) => {
  // Isolated UI fixtures; SQLite persistence and validation are covered in backend tests.
  let payment = {
    id: 1, organization_id: 1, organization_name: "Đơn vị kiểm thử",
    description: "Đào tạo", quantity: "2", unit_price: 150000, amount: 300000,
    work_date: "2026-11-02", due_date: null as string | null, status: "UNPAID", version: 1,
    created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:00Z",
  };
  await page.route("**/api/auth/session", route => route.fulfill({
    json: { authenticated: true, username: "payment-test", is_admin: false },
  }));
  await page.routeWebSocket("**/ws", socket => socket.onMessage(raw => {
    const message = JSON.parse(String(raw));
    let data: unknown;
    if (message.action === "organization.list") data = [{ id: 1, name: payment.organization_name }];
    else if (message.action === "payment.list") data = { items: [payment], total: 1, page: 1, page_size: 20 };
    else if (message.action === "payment.update" || message.action === "payment.updateStatus") {
      payment = { ...payment, ...message.payload, version: payment.version + 1 };
      data = payment;
    } else if (message.action === "system.ping") data = { pong: true };
    else data = { totals: { total: 300000, paid: 0, unpaid: 300000, count: 1, paid_count: 0, unpaid_count: 1 }, organizations: [], periods: [] };
    socket.send(JSON.stringify({ requestId: message.requestId, success: true, data }));
  }));
  await page.goto("/payments");
  await expect(page.getByRole("columnheader")).toHaveText([
    "Đơn vị", "Hạng mục", "Số lượng", "Đơn giá", "Tổng tiền", "Hạn TT", "Trạng thái", "Thao tác",
  ]);
  const row = page.getByRole("row").filter({ hasText: payment.organization_name });
  await expect(row.getByRole("cell")).toHaveCount(8);
  await expect(row.getByRole("cell").nth(0)).toHaveText(payment.organization_name);
  await expect(row.getByRole("cell").nth(1)).toHaveText("Đào tạo");
  await expect(row.getByRole("cell").nth(5)).toHaveText("—");
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(page.getByLabel("Ngày thực hiện *", { exact: true })).toHaveValue("2026-11-02");
  const dueDate = page.getByLabel("Hạn TT", { exact: true });
  await dueDate.fill("2026-12-15");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row.getByRole("cell").nth(5)).toHaveText("15/12/2026");
  const received = row.getByRole("cell").nth(6).getByRole("checkbox", { name: "Đã nhận", exact: true });
  await received.click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(received).toBeChecked();
  await expect(row.getByRole("cell").nth(6)).toContainText("Đã nhận");
  await page.screenshot({ path: `../docs/screenshots/payments-table-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.reload();
  await expect(row.getByRole("cell").nth(5)).toHaveText("15/12/2026");
  await row.getByRole("button", { name: /^Xem / }).click();
  await expect(page.getByRole("dialog")).toContainText("15/12/2026");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(dueDate).toHaveValue("2026-12-15");
  await dueDate.fill("");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(row.getByRole("cell").nth(5)).toHaveText("—");
});
