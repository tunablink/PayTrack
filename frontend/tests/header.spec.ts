import { test, expect } from "@playwright/test";

test("header hiển thị avatar, tên và vai trò đúng bố cục", async ({
  page,
}, testInfo) => {
  // Isolated presentation test: no real account, session or business data is read or changed.
  let username = "tuna";
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, username, is_admin: true }),
    }),
  );
  await page.routeWebSocket("**/ws", (socket) =>
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      const totals = {
        total: 0,
        paid: 0,
        unpaid: 0,
        count: 0,
        paid_count: 0,
        unpaid_count: 0,
      };
      const data =
        message.action === "organization.list"
          ? []
          : message.action === "payment.list"
            ? { items: [], total: 0, page: 1, page_size: 20 }
            : message.action === "system.ping"
              ? { pong: true }
              : { totals, organizations: [], periods: [] };
      socket.send(
        JSON.stringify({ requestId: message.requestId, success: true, data }),
      );
    }),
  );
  await page.goto("/dashboard");
  const header = page.getByRole("banner");
  const profile = header.getByRole("group", { name: "Tài khoản người dùng" });
  const avatar = page.getByTestId("account-avatar");
  const name = page.getByTestId("account-name");
  await expect(name).toHaveText("tuna");
  await expect(avatar).toHaveText("TU");
  await expect(profile).toHaveCSS("display", "flex");
  await expect(avatar).toHaveCSS("border-radius", "50%");
  await expect(header.getByText("Đã kết nối", { exact: true })).toHaveCount(0);
  const avatarBox = (await avatar.boundingBox())!;
  const nameBox = (await name.boundingBox())!;
  const logoutBox = (await header
    .getByRole("button", { name: "Đăng xuất", exact: true })
    .boundingBox())!;
  expect(avatarBox.x + avatarBox.width).toBeLessThanOrEqual(nameBox.x);
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(logoutBox.x);
  await header.screenshot({
    path: `../docs/screenshots/header-${testInfo.project.name}.png`,
  });
  username = "tuna_" + "ten_nguoi_dung_dai_".repeat(5);
  await page.reload();
  await expect(name).toHaveAttribute("title", username);
  await expect(name).toHaveCSS("text-overflow", "ellipsis");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const profileBox = (await profile.boundingBox())!;
  expect(profileBox.x).toBeGreaterThanOrEqual(0);
  expect(profileBox.x + profileBox.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});
