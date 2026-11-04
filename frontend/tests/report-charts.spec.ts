import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { reportDateRange } from "../lib/reports";
import type { Summary, Totals } from "../lib/types";

const totals = (
  paid: number,
  unpaid: number,
  paid_count: number,
  unpaid_count: number,
): Totals => ({
  paid,
  unpaid,
  total: paid + unpaid,
  paid_count,
  unpaid_count,
  count: paid_count + unpaid_count,
});
const empty: Summary = {
  totals: totals(0, 0, 0, 0),
  organizations: [],
  periods: [],
};
const full: Summary = {
  totals: totals(3000000, 1250000, 2, 2),
  organizations: [
    { id: 1, name: "Đơn vị A", ...totals(1000000, 500000, 1, 1) },
    { id: 2, name: "Đơn vị B", ...totals(2000000, 750000, 1, 1) },
  ],
  periods: [
    { period: "2026-04", ...totals(0, 750000, 0, 1) },
    { period: "2026-02", ...totals(2000000, 500000, 1, 1) },
    { period: "2026-01", ...totals(1000000, 0, 1, 0) },
  ],
};
const organizationA: Summary = {
  totals: totals(1000000, 500000, 1, 1),
  organizations: [full.organizations[0]],
  periods: [
    { period: "2026-02", ...totals(0, 500000, 0, 1) },
    { period: "2026-01", ...totals(1000000, 0, 1, 0) },
  ],
};

async function setup(page: Page, zeroValue = false, requests: {action:string;payload:Record<string,unknown>}[] = []) {
  // Explicit presentation fixtures; no real user session or business data is accessed.
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        username: "chart-test",
        is_admin: false,
      }),
    }),
  );
  await page.routeWebSocket("**/ws", (socket) =>
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      requests.push(message);
      let data: unknown;
      if (message.action === "organization.list")
        data = [
          { id: 1, name: "Đơn vị A", notes: "", version: 1 },
          { id: 2, name: "Đơn vị B", notes: "", version: 1 },
        ];
      else if (message.action === "payment.list")
        data = { items: [], total: 0, page: 1, page_size: 20 };
      else if (message.action === "system.ping") data = { pong: true };
      else if (message.action === "report.years") data = ["2027", "2026"];
      else {
        const filter = message.payload;
        data = full;
        if (filter.organization_id === 1) data = organizationA;
        if (filter.organization_id === 1 && filter.status === "PAID")
          data = {
            totals: totals(1000000, 0, 1, 0),
            organizations: [
              { id: 1, name: "Đơn vị A", ...totals(1000000, 0, 1, 0) },
            ],
            periods: [{ period: "2026-01", ...totals(1000000, 0, 1, 0) }],
          };
        if (filter.start_date === "2027-01-01") data = empty;
        if (zeroValue)
          data = {
            totals: totals(0, 0, 0, 1),
            organizations: [{ id: 1, name: "Đơn vị A", ...totals(0, 0, 0, 1) }],
            periods: [{ period: "2026-01", ...totals(0, 0, 0, 1) }],
          };
      }
      socket.send(
        JSON.stringify({ requestId: message.requestId, success: true, data }),
      );
    }),
  );
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", {
      name: "Diễn biến dòng tiền",
      exact: true,
    }),
  ).toBeVisible();
}

test("biểu đồ báo cáo theo tháng/quý, tỷ trọng, thứ hạng và bộ lọc", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await expect(page.getByRole("heading", { name: "Đối chiếu theo đơn vị", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Đối chiếu theo tháng", exact: true })).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByTestId("report-period-2026-01")).toHaveAttribute(
    "aria-label",
    /1\.000\.000/,
  );
  await expect(
    page.getByRole("img", { name: /^Tổng phải thu/ }),
  ).toHaveAttribute("aria-label", /70,6%/);
  const ranking = page.getByRole("region", {
    name: "Khoản chưa nhận theo đơn vị",
    exact: true,
  });
  await expect(ranking.getByRole("listitem").first()).toContainText("Đơn vị B");
  await expect(ranking.getByRole("listitem").first()).toContainText("60%");
  await page.getByRole("button", { name: "Theo quý", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Theo quý", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("report-period-2026-Q1").focus();
  await expect(
    page.getByRole("status").filter({ hasText: "Q1/2026" }),
  ).toContainText("3.000.000");
  await expect(
    page.getByRole("status").filter({ hasText: "Q1/2026" }),
  ).toContainText("500.000");
  await page.getByRole("button", { name: "Đường tổng", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Đường tổng", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Theo tháng", exact: true }).click();
  await expect(page.getByTestId("report-period-2026-02")).toBeVisible();
  await page.screenshot({
    path: `../docs/screenshots/report-charts-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .getByRole("combobox", { name: "Đối tác", exact: true })
    .selectOption("1");
  await expect(ranking.getByRole("listitem")).toHaveCount(1);
  await expect(ranking.getByRole("listitem")).toContainText("Đơn vị A");
  await expect(page.getByTestId("report-period-2026-04")).toHaveCount(0);
  await expect(page.getByTestId("report-period-2026-02")).toHaveAttribute("aria-label", /500\.000/);
  await expect(
    page.getByRole("img", { name: /^Tổng phải thu/ }),
  ).toHaveAttribute("aria-label", /1\.500\.000/);
  await page.getByRole("combobox", { name: "Năm", exact: true }).selectOption("2027");
  await expect(
    page.getByText("Chưa có dữ liệu trong bộ lọc.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa có giá trị khoản phải thu để hiển thị biểu đồ.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Tỷ lệ thu hồi công nợ" })).toHaveAttribute("aria-valuenow", "0");
  await expect(ranking.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByTestId("report-period-2026-01")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("bốn chỉ số, bộ lọc mới và xuất báo cáo theo đối tác/quý", async ({ page }) => {
  const requests: {action:string;payload:Record<string,unknown>}[] = [];
  await setup(page, false, requests);
  await expect(page.locator('.metric')).toHaveCount(4);
  await expect(page.locator('.metric').nth(0)).toContainText('Tổng doanh thu hợp đồng');
  await expect(page.locator('.metric').nth(1)).toContainText('Tổng khoản thu đã nhận');
  await expect(page.locator('.metric').nth(2)).toContainText('Dư nợ');
  await expect(page.locator('.metric').nth(3)).toContainText('70,6%');
  for (const label of ['Đơn vị','Trạng thái','Từ ngày','Đến ngày'])
    await expect(page.getByLabel(label, {exact:true})).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Đặt lại',exact:true})).toHaveCount(0);
  const period = page.getByRole('combobox', {name:'Khoảng thời gian',exact:true});
  await period.selectOption('six_months');
  const range = reportDateRange('2026','six_months');
  await expect.poll(() => requests.filter(r=>r.action==='report.summary').at(-1)?.payload).toEqual(range);
  await page.getByRole('combobox', {name:'Đối tác',exact:true}).selectOption('1');
  await period.selectOption('quarter');
  const exportButton=page.getByRole('button', {name:'Xuất báo cáo',exact:true});
  await expect(exportButton).toBeEnabled();
  await expect(page.locator('.metric').nth(3)).toContainText('66,7%');
  await expect(page.getByTestId('report-period-2026-Q1')).toBeVisible();
  const downloaded=page.waitForEvent('download');
  await exportButton.click();
  const download=await downloaded;
  expect(download.suggestedFilename()).toBe('bao-cao-2026-quarter.csv');
  const csv=await readFile((await download.path())!, 'utf8');
  expect(csv.startsWith('\uFEFF')).toBeTruthy();
  expect(csv).toContain('"Đối tác","Đơn vị A"');
  expect(csv).toContain('"Tỷ lệ thu hồi công nợ","66,7%"');
  expect(csv).toContain('"2026-Q1","2","1","1","1500000","1000000","500000"');
  expect(csv).not.toContain('Đơn vị B');
  await period.selectOption('year');
  await expect(page.getByTestId('report-period-2026-01')).toBeVisible();
});

test("khoảng sáu tháng qua năm mới và năm cũ", () => {
  const now = new Date('2026-01-15T08:00:00Z');
  expect(reportDateRange('2026','six_months',now)).toEqual({start_date:'2025-08-01',end_date:'2026-01-15'});
  expect(reportDateRange('2025','six_months',now)).toEqual({start_date:'2025-07-01',end_date:'2025-12-31'});
  expect(reportDateRange('2025','year',now)).toEqual({start_date:'2025-01-01',end_date:'2025-12-31'});
});

test("biểu đồ xử lý khoản có giá trị bằng không", async ({ page }) => {
  await setup(page, true);
  await expect(
    page.getByText("Chưa có giá trị khoản phải thu để hiển thị biểu đồ.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Tổng phải thu/ }),
  ).toHaveAttribute("aria-label", /Tổng phải thu 0/);
  await expect(page.getByRole("main")).not.toContainText("NaN");
  await expect(page.getByRole("main")).not.toContainText("Infinity");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
