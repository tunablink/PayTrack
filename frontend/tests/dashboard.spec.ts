import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Payment } from "../lib/types";

test("tổng quan đủ các khối, lọc kỳ, phân trang, nhắc hạn và xuất báo cáo", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-11-20T08:00:00Z"));
  const records: Payment[] = Array.from({ length: 101 }, (_, index) => ({
    id: index + 1, organization_id: index % 2 + 1, organization_name: index % 2 ? "Đối tác B" : "Đối tác A",
    description: `Hạng mục ${index + 1}`, quantity: "1", unit_price: 100000, amount: 100000,
    work_date: "2026-11-10", due_date: index === 0 ? "2026-11-15" : "2026-12-01",
    status: index < 70 ? "PAID" : "UNPAID", version: 1,
    created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-19T00:00:00Z",
  }));
  records[100].due_date = "2026-11-15";
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/auth/session", route => route.fulfill({ json: { authenticated: true, username: "dashboard-test", is_admin: false } }));
  await page.routeWebSocket("**/ws", socket => socket.onMessage(raw => {
    const message = JSON.parse(String(raw));
    let data: unknown;
    if (message.action === "organization.list") data = [{ id: 1, name: "Đối tác A" }, { id: 2, name: "Đối tác B" }];
    else if (message.action === "payment.list") {
      requests.push(message.payload);
      const { start_date, end_date, page: current, page_size } = message.payload;
      const items = records.filter(record => (!start_date || record.work_date >= start_date) && (!end_date || record.work_date <= end_date));
      data = { items: items.slice((current - 1) * page_size, current * page_size), total: items.length, page: current, page_size };
    } else if (message.action === "system.ping") data = { pong: true };
    else data = {};
    socket.send(JSON.stringify({ requestId: message.requestId, success: true, data }));
  }));
  await page.goto("/dashboard");
  const hero = page.getByRole("region", { name: "Tổng khoản phải thu", exact: true });
  await expect(hero).toContainText("10.100.000");
  expect(requests.some(request => request.page === 2 && request.page_size === 100)).toBeTruthy();
  const cash = page.getByRole("region", { name: "Trạng thái dòng tiền", exact: true });
  await expect(cash).toContainText("7.000.000");
  await expect(cash).toContainText("3.100.000");
  await expect(cash).toContainText("100.000");
  await expect(page.getByRole("heading", { name: "Thao tác nhanh & Nhắc nhở", exact: true })).toBeVisible();
  const recent = page.getByRole("region", { name: "Khoản thu gần đây", exact: true });
  await expect(recent.getByRole("row")).toHaveCount(5);
  await recent.getByRole("button", { name: "Chưa nhận (31)", exact: true }).click();
  await expect(recent.getByRole("cell", { name: "Hạng mục 71", exact: true })).toBeVisible();
  await recent.getByRole("button", { name: "Trang sau", exact: true }).click();
  await expect(recent.getByRole("cell", { name: "Hạng mục 75", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xem khoản cần thu", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Hạng mục 101");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await expect(page.getByRole("region", { name: "Lịch sử nhận tiền", exact: true })).toContainText("Đối tác A");
  await expect(page.getByRole("region", { name: "Tỷ trọng doanh thu", exact: true })).toContainText("50,5%");
  await page.getByRole("button", { name: "Thêm đơn vị mới", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Thêm đơn vị");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByRole("button", { name: "Thêm khoản thu mới", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Thêm khoản phải thu");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất báo cáo Excel", exact: true }).click();
  const download = await downloaded;
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain('"Tổng khoản phải thu","10100000"');
  expect(csv).toContain('"Hạng mục 101"');
  await page.screenshot({ path: `../docs/screenshots/dashboard-new-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await cash.getByRole("button", { name: "Quý", exact: true }).click();
  await expect.poll(() => requests.at(-1)?.start_date).toBe("2026-10-01");
  await cash.getByRole("button", { name: "Tuần", exact: true }).click();
  await expect(hero).toContainText("0 ₫");
  await expect(page.getByText("Chưa có khoản đã nhận trong kỳ.", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa có dữ liệu doanh thu trong kỳ.", { exact: true })).toBeVisible();
  await cash.getByRole("button", { name: "Tháng", exact: true }).click();
  await expect(hero).toContainText("10.100.000");
  await expect(page.getByRole("main")).not.toContainText("NaN");
});
