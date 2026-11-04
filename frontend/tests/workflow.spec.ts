import { test, expect } from "@playwright/test";

test("đăng nhập → đơn vị → khoản phải thu → đã nhận → báo cáo, dialog, offline và sao lưu", async ({
  page,
  context,
}, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Tên đăng nhập").fill("e2e-owner");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Đơn vị", exact: true })
    .click();
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thêm đơn vị", exact: true }).click();
  const org = `Đại học Kiểm thử ${testInfo.project.name}`;
  await page.getByLabel("Tên tổ chức *").fill(org);
  await page
    .getByLabel("Ghi chú", { exact: true })
    .fill("Ghi chú tiếng Việt dài ".repeat(30));
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(org, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thêm đơn vị", exact: true }).click();
  await page.getByLabel("Tên tổ chức *").fill("Không lưu");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Thêm đơn vị", exact: true }).click();
  await expect(page.getByLabel("Tên tổ chức *")).toHaveValue("");
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Quản lí khoản thu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Thêm khoản phải thu", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Đơn vị *", exact: true })
    .selectOption({ label: org });
  await page
    .getByLabel("Nội dung công việc *")
    .fill("Giảng dạy chuyên đề và đối soát công việc ".repeat(7));
  await page.getByLabel("Số lượng *").fill("20");
  await page.getByLabel("Đơn giá (đồng) *").fill("200000");
  await page.getByLabel("Ngày thực hiện *").fill("2026-11-02");
  await expect(
    page.getByText("4.000.000", { exact: false }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: org });
  await expect(row).toBeVisible();
  await expect(row.getByText("Chưa nhận", { exact: true })).toBeVisible();
  const received = row.getByRole("checkbox", { name: "Đã nhận", exact: true });
  await expect(received).not.toBeChecked();
  await received.click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(received).not.toBeChecked();
  await received.click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(received).toBeChecked();
  await expect(row.getByText("Đã nhận", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: /^Xem / }).click();
  await expect(page.getByRole("dialog")).toContainText("4.000.000");
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(page.getByLabel("Nội dung công việc *")).toContainText(
    "Giảng dạy",
  );
  await page
    .getByLabel("Nội dung công việc *")
    .fill(
      "Giảng dạy chuyên đề và đối soát công việc ".repeat(7) + "Đã đối chiếu",
    );
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row).toContainText("Đã đối chiếu");
  await received.click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(row.getByText("Chưa nhận", { exact: true })).toBeVisible();
  await expect(received).not.toBeChecked();
  await received.click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(row.getByText("Đã nhận", { exact: true })).toBeVisible();
  await expect(received).toBeChecked();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Đơn vị", exact: true })
    .click();
  const orgRow = page.getByRole("row").filter({ hasText: org });
  await orgRow.getByRole("button", { name: "Xóa", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Không thể xóa đơn vị",
  );
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await orgRow.getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByLabel("Ghi chú", { exact: true }).fill("Đã cập nhật");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Báo cáo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Diễn biến dòng tiền" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Đối tác", exact: true })
    .selectOption({ label: org });
  await expect(page.locator(".metric").nth(0)).toContainText("4.000.000");
  await expect(page.locator(".metric").nth(1)).toContainText("4.000.000");
  await expect(page.locator(".metric").nth(2)).toContainText("0");
  await expect(page.locator(".metric").nth(3)).toContainText("100%");
  await page.getByRole("combobox", { name: "Khoảng thời gian", exact: true }).selectOption("quarter");
  await expect(page.getByTestId("report-period-2026-Q4")).toBeVisible();
  await page.getByRole("combobox", { name: "Khoảng thời gian", exact: true }).selectOption("year");
  await expect(page.locator(".metric").nth(0)).toContainText("4.000.000");
  await page.screenshot({
    path: `../docs/screenshots/reports-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Quản lí khoản thu", exact: true })
    .click();
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible();
  await page.getByLabel("Tìm công việc").fill("Không tồn tại");
  await expect(
    page.getByText("Không có khoản phải thu phù hợp.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đặt lại", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: org })).toBeVisible();
  await page.screenshot({
    path: `../docs/screenshots/payments-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: "Thêm khoản phải thu", exact: true }),
  ).toBeDisabled({ timeout: 25000 });
  await expect(page.getByRole("row").filter({ hasText: org })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible({
    timeout: 40000,
  });
  await expect(page.getByRole("row").filter({ hasText: org })).toBeVisible();
  {
    await page
      .getByRole("button", { name: "Sao lưu dữ liệu", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tạo bản sao lưu", exact: true })
      .click();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(
      "Đã sao lưu",
    );
    await page
      .getByRole("button", { name: "Đóng", exact: true })
      .last()
      .click();
  }
  await page
    .getByRole("row")
    .filter({ hasText: org })
    .getByRole("button", { name: "Xóa", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: org })).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Đơn vị", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: org })
    .getByRole("button", { name: "Xóa", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: org })).toHaveCount(0);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(consoleErrors).toEqual([]);
});

test("WebSocket timeout không báo lưu thành công và tự kết nối lại", async ({
  page,
}, testInfo) => {
  const lostName = `Mất phản hồi kiểm thử ${testInfo.project.name}`;
  // Keep transport open but drop one write response, simulating commit followed by lost response.
  await page.routeWebSocket("**/ws", (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      const response = JSON.parse(String(message));
      if (response.data?.name === lostName) return;
      ws.send(message);
    });
  });
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("e2e-owner");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Đơn vị", exact: true })
    .click();
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thêm đơn vị", exact: true }).click();
  await page.getByLabel("Tên tổ chức *").fill(lostName);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Kết quả lưu chưa xác định",
    { timeout: 20000 },
  );
  await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.getByText("Đã kết nối", { exact: true })).toBeVisible({
    timeout: 40000,
  });
  await expect(page.getByRole("row").filter({ hasText: lostName })).toHaveCount(
    1,
  );
});
