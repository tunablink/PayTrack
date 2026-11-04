"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  DatabaseBackup,
  Download,
  Eye,
  LayoutDashboard,
  Mail,
  Phone,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Wallet,
  ChartNoAxesCombined,
} from "lucide-react";
import { SocketClient, Connection } from "@/lib/socket";
import {
  Filters,
  Organization,
  Payment,
  PaymentList,
  Summary,
  money,
  day,
  timestamp,
  organizationStatusLabel,
} from "@/lib/types";
import { Badge, Button, Dialog, Empty, Field } from "./ui";
import { RecordForm } from "./record-form";
import WorkspaceHeader from "./workspace-header";
import Dashboard from "./dashboard";
import ReportCharts from "./report-charts";
import ReportOverview from "./report-overview";
import { downloadReport, localReportDate, reportDateRange, type ReportMode } from "@/lib/reports";
import organizationStyles from "./organizations-table.module.css";
type View = "dashboard" | "organizations" | "payments" | "reports";
type Modal =
  | { kind: "organization" | "payment"; record?: Organization | Payment }
  | { kind: "delete" | "status" | "detail"; record: Organization | Payment }
  | { kind: "backup" };
const titles: Record<View, string> = {
  dashboard: "Tổng quan",
  organizations: "Đơn vị",
  payments: "Quản lí khoản thu",
  reports: "Báo cáo",
};
const descriptions: Record<View, string> = {
  dashboard: "Theo dõi khoản phải thu và kết quả nhận tiền.",
  organizations: "Quản lý các đơn vị hợp tác và ghi chú đối soát.",
  payments: "Ghi nhận công việc, theo dõi và cập nhật trạng thái nhận tiền.",
  reports: "Đối chiếu các khoản phải thu theo đơn vị và thời gian.",
};
const navigation = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "organizations", icon: Building2 },
  { id: "payments", icon: ReceiptText },
  { id: "reports", icon: ChartNoAxesCombined },
] as const;
const blankFilters: Filters = {
  search: "",
  organization_id: "",
  status: "",
  start_date: "",
  end_date: "",
};
export default function Workspace({ view }: { view: View }) {
  const router = useRouter();
  const socket = useRef<SocketClient | null>(null);
  const reload = useRef<() => void>(() => {});
  const sequence = useRef(0);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [username, setUsername] = useState("");
  const [canBackup, setCanBackup] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [payments, setPayments] = useState<PaymentList | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dashboardRevision, setDashboardRevision] = useState(0);
  const loadDashboardPayments = useCallback((payload: Record<string, unknown>) => socket.current!.request<PaymentList>("payment.list", payload), []);
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [organizationType, setOrganizationType] = useState("");
  const [organizationStatus, setOrganizationStatus] = useState("");
  const organizationTypes = [...new Set(organizations.map(org => org.organization_type?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "vi"));
  const filteredOrganizations = organizations.filter(org =>
    org.name.toLocaleLowerCase("vi").includes(filters.search.trim().toLocaleLowerCase("vi")) &&
    (!organizationType || org.organization_type?.trim() === organizationType) &&
    (!organizationStatus || org.status === organizationStatus)
  );
  const [reportYear, setReportYear] = useState(() => localReportDate().year);
  const [reportMode, setReportMode] = useState<ReportMode>("year");
  const [reportPartner, setReportPartner] = useState("");
  const [reportYears, setReportYears] = useState<string[]>([]);
  const [loadedReportKey, setLoadedReportKey] = useState("");
  const reportPayload = useMemo(() => ({
    ...reportDateRange(reportYear, reportMode),
    ...(reportPartner ? { organization_id: Number(reportPartner) } : {}),
  }), [reportYear, reportMode, reportPartner]);
  const reportKey = JSON.stringify(reportPayload);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const [backup, setBackup] = useState<{
    job_id: string;
    state: string;
    filename?: string;
    message?: string;
  } | null>(null);
  const connected = connection === "connected";
  const load = useCallback(async () => {
    const client = socket.current;
    if (client?.socket?.readyState !== WebSocket.OPEN) return;
    const current = ++sequence.current;
    setLoading(true);
    const payload = view === "reports" ? reportPayload : Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => [k, k === "organization_id" ? Number(v) : v]),
    );
    try {
      if (view === "dashboard") {
        const orgs = await client.request<Organization[]>("organization.list", {});
        if (current === sequence.current) {
          setOrganizations(orgs);
          setDashboardRevision(value => value + 1);
        }
        return;
      }
      const [orgs, list, totals, years] = await Promise.all([
        client.request<Organization[]>("organization.list", {}),
        client.request<PaymentList>("payment.list", {
          ...payload,
          page,
          page_size: 20,
        }),
        client.request<Summary>(
          view === "reports" ? "report.summary" : "dashboard.summary",
          payload,
        ),
        view === "reports" ? client.request<string[]>("report.years", {}) : Promise.resolve([]),
      ]);
      if (current === sequence.current) {
        setOrganizations(orgs);
        setPayments(list);
        setSummary(totals);
        if (view === "reports") {
          setReportYears(years);
          setLoadedReportKey(JSON.stringify(payload));
        }
      }
    } catch (e) {
      if (current === sequence.current)
        setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [filters, page, view, reportPayload]);
  useEffect(() => {
    reload.current = () => {
      void load();
    };
  }, [load]);
  useEffect(() => {
    let active = true;
    let client: SocketClient | undefined;
    fetch("/api/auth/session")
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok)
          throw new Error("Không thể kiểm tra phiên đăng nhập.");
        const data = await response.json();
        if (!active) return;
        setUsername(data.username);
        setCanBackup(data.is_admin === true);
        client = new SocketClient(
          (state) => {
            if (active) {
              setConnection(state);
              if (state === "expired") router.replace("/login");
            }
          },
          () => reload.current(),
        );
        socket.current = client;
        client.connect();
      })
      .catch(() => {
        if (active) {
          setError(
            "Không thể kết nối backend. Kiểm tra máy chủ rồi tải lại trang.",
          );
          setLoading(false);
        }
      });
    const refresh = () => reload.current();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      client?.close();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  useEffect(() => {
    const timer = setTimeout(() => reload.current(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!backup || !["QUEUED", "RUNNING"].includes(backup.state)) return;
    const timer = setInterval(() => {
      socket.current
        ?.request<typeof backup>("backup.status", { job_id: backup.job_id })
        .then(setBackup)
        .catch((e) => setError(e.message));
    }, 1000);
    return () => clearInterval(timer);
  }, [backup]);
  function filter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }
  async function mutate(action: string, payload: object) {
    if (busy || !connected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await socket.current!.request(action, payload, true);
      setModal(null);
      setNotice("Đã lưu thay đổi.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu dữ liệu.");
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw new Error("Không thể đăng xuất.");
      socket.current?.close();
      router.replace("/login");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function startBackup() {
    setBusy(true);
    setError("");
    try {
      setBackup(await socket.current!.request("backup.start", {}, true));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const hasPayment = (record: Organization | Payment): record is Payment =>
    "description" in record;
  function actions(record: Organization | Payment) {
    const payment = hasPayment(record);
    return (
      <div className="row-actions">
        <Button
          aria-label={`Xem ${payment ? record.description : record.name}`}
          title="Xem chi tiết"
          onClick={() => setModal({ kind: "detail", record })}
        >
          <Eye size={15} />
        </Button>
        {payment && view !== "payments" && (
          <Button
            title={
              record.status === "PAID" ? "Chuyển Chưa nhận" : "Đánh dấu Đã nhận"
            }
            aria-label={
              record.status === "PAID" ? "Chuyển Chưa nhận" : "Đánh dấu Đã nhận"
            }
            disabled={!connected || busy}
            onClick={() => setModal({ kind: "status", record })}
          >
            <Check size={15} />
          </Button>
        )}
        <Button
          aria-label="Sửa"
          title="Sửa"
          disabled={!connected || busy}
          onClick={() =>
            setModal({ kind: payment ? "payment" : "organization", record })
          }
        >
          <Pencil size={15} />
        </Button>
        <Button
          aria-label="Xóa"
          title="Xóa"
          className="danger-ghost"
          disabled={!connected || busy}
          onClick={() => setModal({ kind: "delete", record })}
        >
          <Trash2 size={15} />
        </Button>
      </div>
    );
  }
  const paymentTable = (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {view === "payments" ? <><th>Đơn vị</th><th>Hạng mục</th></> : <th>Đơn vị / Công việc</th>}
            <th className="number">Số lượng</th>
            <th className="number">Đơn giá</th>
            <th className="number">{view === "payments" ? "Tổng tiền" : "Thành tiền"}</th>
            <th title={view === "payments" ? "Hạn thanh toán" : undefined}>{view === "payments" ? "Hạn TT" : "Ngày thực hiện"}</th>
            <th>Trạng thái</th>
            <th className="text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {payments?.items.map((p) => (
            <tr key={p.id}>
              <td className="work-cell">
                <strong>{p.organization_name}</strong>
                {view !== "payments" && <span>{p.description}</span>}
              </td>
              {view === "payments" && <td>{p.description}</td>}
              <td className="number">
                {new Intl.NumberFormat("vi-VN", {
                  maximumFractionDigits: 3,
                }).format(Number(p.quantity))}
              </td>
              <td className="number nowrap">{money(p.unit_price)}</td>
              <td className="number nowrap font-semibold">{money(p.amount)}</td>
              <td className="nowrap">{view === "payments" ? (p.due_date ? day(p.due_date) : "—") : day(p.work_date)}</td>
              <td>
                {view === "payments" ? (
                  <div className="flex items-center gap-1">
                  <label
                    className="payment-status-toggle"
                    title={
                      p.status === "PAID"
                        ? "Bỏ tick để chuyển Chưa nhận"
                        : "Tick để đánh dấu Đã nhận"
                    }
                  >
                    <input
                      type="checkbox"
                      className="payment-status-checkbox"
                      aria-label="Đã nhận"
                      checked={p.status === "PAID"}
                      disabled={!connected || busy}
                      onChange={() => setModal({ kind: "status", record: p })}
                    />
                  </label>
                  <Badge status={p.status} />
                  </div>
                ) : <Badge status={p.status} />}
              </td>
              <td>{actions(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {payments?.items.length === 0 && (
        <Empty>
          Không có khoản phải thu phù hợp. Thêm khoản mới hoặc thay đổi bộ lọc.
        </Empty>
      )}
    </div>
  );
  return (
    <div className="app-shell" data-connection={connection}>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-icon">
            <Wallet size={20} />
          </span>
          <span>PayTrack</span>
        </Link>
        <p className="sidebar-caption">QUẢN LÝ CÁ NHÂN</p>
        <nav aria-label="Điều hướng chính">
          {navigation.map(({ id, icon: Icon }) => (
            <Link
              key={id}
              href={`/${id}`}
              aria-current={view === id ? "page" : undefined}
              className={`nav-item ${view === id ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{titles[id]}</span>
            </Link>
          ))}
        </nav>
        {canBackup && (
          <div className="sidebar-bottom">
            <Button onClick={() => setModal({ kind: "backup" })}>
              <DatabaseBackup size={17} />
              <span>Sao lưu dữ liệu</span>
            </Button>
          </div>
        )}
      </aside>
      <div className="main-shell">
        <WorkspaceHeader
          title={titles[view]}
          username={username}
          canBackup={canBackup}
          busy={busy}
          onBackup={() => setModal({ kind: "backup" })}
          onLogout={logout}
        />
        <main className="workspace">
          {view !== "dashboard" && (
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                PAYTRACK / {view === "reports" ? "ĐỐI CHIẾU" : "SỔ THEO DÕI"}
              </p>
              <h1>{titles[view]}</h1>
              <p className="muted mt-2">{descriptions[view]}</p>
            </div>
            {view === "reports" ? (
              <div className="flex gap-2">
              <Button primary disabled={loading || !summary || loadedReportKey !== reportKey}
                onClick={() => summary && downloadReport(summary, {
                  year: reportYear, mode: reportMode,
                  partner: organizations.find(org => String(org.id) === reportPartner)?.name ?? "Tất cả đối tác",
                  ...reportPayload,
                })}>
                <Download size={17} />Xuất báo cáo
              </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  primary
                  disabled={
                    !connected ||
                    busy ||
                    (view !== "organizations" && organizations.length === 0)
                  }
                  onClick={() =>
                    setModal({
                      kind:
                        view === "organizations" ? "organization" : "payment",
                    })
                  }
                >
                  <Plus size={17} />
                  {view === "organizations"
                    ? "Thêm đơn vị"
                    : "Thêm khoản phải thu"}
                </Button>
              </div>
            )}
          </div>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
              <button aria-label="Đóng thông báo" onClick={() => setError("")}>
                Đóng
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice success">
              {notice}
            </div>
          )}
          {!connected && (
            <div className="notice warning">
              {connection === "connecting"
                ? "Đang thiết lập kết nối với máy chủ…"
                : "Kết nối bị gián đoạn. Bạn có thể xem dữ liệu đã tải; thao tác ghi tạm khóa. Hệ thống sẽ tự kết nối lại."}
            </div>
          )}
          {view === "payments" && (
            <div className="filter-bar">
              <Field label="Đơn vị">
                <select
                  value={filters.organization_id}
                  onChange={(e) => filter("organization_id", e.target.value)}
                >
                  <option value="">Tất cả đơn vị</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trạng thái">
                <select
                  value={filters.status}
                  onChange={(e) => filter("status", e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="UNPAID">Chưa nhận</option>
                  <option value="PAID">Đã nhận</option>
                </select>
              </Field>
              <Field label="Từ ngày">
                <input
                  aria-label="Từ ngày"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => filter("start_date", e.target.value)}
                />
              </Field>
              <Field label="Đến ngày">
                <input
                  aria-label="Đến ngày"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => filter("end_date", e.target.value)}
                />
              </Field>
              <Button
                onClick={() => {
                  setFilters(blankFilters);
                  setPage(1);
                }}
              >
                Đặt lại
              </Button>
            </div>
          )}
          {view === "dashboard" ? (
            <Dashboard connected={connected} busy={busy} revision={dashboardRevision}
              organizationCount={organizations.length} loadPayments={loadDashboardPayments}
              onAddPayment={() => setModal({ kind: "payment" })}
              onAddOrganization={() => setModal({ kind: "organization" })}
              onDetail={record => setModal({ kind: "detail", record })} />
          ) : loading && !payments ? (
            <div className="empty" role="status">
              Đang tải dữ liệu…
            </div>
          ) : (
            <>
              {view === "reports" && summary && (
                <ReportOverview summary={summary} year={reportYear} mode={reportMode} partner={reportPartner}
                  years={[...new Set([localReportDate().year, reportYear, ...reportYears])].sort().reverse()}
                  organizations={organizations} start={reportPayload.start_date} end={reportPayload.end_date}
                  onYear={setReportYear} onPartner={setReportPartner} onMode={setReportMode} />
              )}
              {view === "organizations" ? (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      Danh sách đơn vị{" "}
                      <span className="count">{filteredOrganizations.length}</span>
                    </h2>
                  </div>
                  <div className={organizationStyles.filters}>
                    <div className="field">
                      <label htmlFor="organization-search">Tìm kiếm</label>
                      <div className={`search ${organizationStyles.search}`}>
                      <Search size={17} />
                      <input
                        id="organization-search"
                        aria-label="Tìm đơn vị"
                        placeholder="Tìm tên đơn vị…"
                        value={filters.search}
                        onChange={(e) => filter("search", e.target.value)}
                      />
                      </div>
                    </div>
                    <Field label="Lọc loại hình">
                      <select value={organizationType} onChange={event => setOrganizationType(event.target.value)}>
                        <option value="">Tất cả loại hình</option>
                        {organizationTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </Field>
                    <Field label="Lọc trạng thái">
                      <select value={organizationStatus} onChange={event => setOrganizationStatus(event.target.value)}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="INACTIVE">Ngừng hoạt động</option>
                      </select>
                    </Field>
                  </div>
                  <div className="table-wrap">
                    <table className={organizationStyles.table}>
                      <thead>
                        <tr>
                          <th>Tên tổ chức</th>
                          <th>Loại hình</th>
                          <th>Người đại diện</th>
                          <th>Thông tin liên hệ</th>
                          <th>Địa chỉ</th>
                          <th>Ghi chú</th>
                          <th>Trạng thái</th>
                          <th className="text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrganizations.map((o) => (
                            <tr key={o.id}>
                              <td>
                                <strong className={organizationStyles.name}>
                                  {o.name}
                                </strong>
                                <span className={organizationStyles.identifier}>
                                  Đơn vị #{o.id}
                                </span>
                              </td>
                              <td className={organizationStyles.content}>
                                {o.organization_type || "—"}
                              </td>
                              <td className={organizationStyles.content}>
                                {o.representative || "—"}
                              </td>
                              <td>
                                <div className={organizationStyles.contact}>
                                  {o.contact_email && (
                                    <a href={`mailto:${o.contact_email}`}>
                                      <Mail size={13} aria-hidden="true" />
                                      <span>{o.contact_email}</span>
                                    </a>
                                  )}
                                  {o.contact_phone && (
                                    <a
                                      href={`tel:${o.contact_phone.replace(/[^\d+]/g, "")}`}
                                    >
                                      <Phone size={13} aria-hidden="true" />
                                      <span>{o.contact_phone}</span>
                                    </a>
                                  )}
                                  {!o.contact_email && !o.contact_phone && "—"}
                                </div>
                              </td>
                              <td className={organizationStyles.content}>
                                {o.address || "—"}
                              </td>
                              <td className={organizationStyles.content}>
                                {o.notes || "—"}
                              </td>
                              <td>
                                <span
                                  className={`badge ${o.status === "INACTIVE" ? organizationStyles.inactive : "paid"}`}
                                >
                                  {organizationStatusLabel(o.status)}
                                </span>
                              </td>
                              <td>{actions(o)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {filteredOrganizations.length === 0 && (
                      <Empty>
                        Chưa có đơn vị phù hợp. Chọn “Thêm đơn vị” để tạo mới.
                      </Empty>
                    )}
                  </div>
                </section>
              ) : view === "reports" ? (
                <>
                  {summary && (
                    <ReportCharts summary={summary} loading={loading}
                      grouping={reportMode === "quarter" ? "quarter" : "month"}
                      onGroupingChange={value => setReportMode(value === "quarter" ? "quarter" : reportMode === "quarter" ? "year" : reportMode)} />
                  )}
                </>
              ) : (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>
                        Danh sách khoản phải thu{" "}
                        <span className="count">{payments?.total || 0}</span>
                      </h2>
                        <label className="search">
                          <Search size={17} />
                          <input
                            aria-label="Tìm công việc"
                            placeholder="Tìm nội dung công việc…"
                            maxLength={500}
                            value={filters.search}
                            onChange={(e) => filter("search", e.target.value)}
                          />
                        </label>
                    </div>
                    {paymentTable}
                    {view === "payments" && (
                      <div className="pagination">
                        <span>
                          {payments?.total || 0} khoản · Trang {page} /{" "}
                          {Math.max(1, Math.ceil((payments?.total || 0) / 20))}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            aria-label="Trang trước"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => p - 1)}
                          >
                            <ChevronLeft size={16} />
                          </Button>
                          <Button
                            aria-label="Trang sau"
                            disabled={
                              loading || page * 20 >= (payments?.total || 0)
                            }
                            onClick={() => setPage((p) => p + 1)}
                          >
                            <ChevronRight size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}
              <p className="footnote">
                Thống kê khoản phải thu theo ngày thực hiện · Tiền tệ VND · Dữ
                liệu tự tải lại mỗi 15 giây
              </p>
            </>
          )}
        </main>
      </div>
      {modal && (modal.kind === "organization" || modal.kind === "payment") && (
        <Dialog
          error={error}
          title={`${modal.record ? "Sửa" : "Thêm"} ${modal.kind === "organization" ? "đơn vị" : "khoản phải thu"}`}
          busy={busy}
          onClose={() => setModal(null)}
        >
          <RecordForm
            kind={modal.kind}
            record={modal.record}
            organizations={organizations}
            busy={busy || !connected}
            onCancel={() => setModal(null)}
            onSave={(payload) =>
              void mutate(
                `${modal.kind}.${modal.record ? "update" : "create"}`,
                payload,
              )
            }
          />
        </Dialog>
      )}
      {modal && (modal.kind === "delete" || modal.kind === "status") && (
        <Dialog
          error={error}
          title={
            modal.kind === "delete" ? "Xác nhận xóa" : "Cập nhật trạng thái"
          }
          busy={busy}
          onClose={() => setModal(null)}
        >
          <p className="mb-4 break-words">
            {hasPayment(modal.record)
              ? modal.record.description
              : modal.record.name}
          </p>
          <p className="muted">
            {modal.kind === "delete"
              ? "Bản ghi sẽ bị xóa vĩnh viễn. Đơn vị còn khoản phải thu sẽ không thể xóa."
              : `Chuyển khoản này thành “${hasPayment(modal.record) && modal.record.status === "PAID" ? "Chưa nhận" : "Đã nhận"}”?`}
          </p>
          <div className="dialog-footer">
            <Button disabled={busy} onClick={() => setModal(null)}>
              Hủy
            </Button>
            <Button
              primary
              disabled={busy || !connected}
              onClick={() => {
                const r = modal.record;
                void mutate(
                  modal.kind === "delete"
                    ? `${hasPayment(r) ? "payment" : "organization"}.delete`
                    : "payment.updateStatus",
                  {
                    id: r.id,
                    version: r.version,
                    ...(modal.kind === "status" && hasPayment(r)
                      ? { status: r.status === "PAID" ? "UNPAID" : "PAID" }
                      : {}),
                  },
                );
              }}
            >
              {busy ? "Đang xử lý…" : "Xác nhận"}
            </Button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "detail" && (
        <Dialog
          error={error}
          title={
            hasPayment(modal.record)
              ? "Chi tiết khoản phải thu"
              : "Chi tiết đơn vị"
          }
          onClose={() => setModal(null)}
        >
          <dl className="details">
            {(hasPayment(modal.record)
              ? [
                  ["Đơn vị", modal.record.organization_name],
                  ["Công việc", modal.record.description],
                  ["Số lượng", modal.record.quantity],
                  ["Đơn giá", money(modal.record.unit_price)],
                  ["Thành tiền", money(modal.record.amount)],
                  ["Ngày thực hiện", day(modal.record.work_date)],
                  ["Hạn TT", modal.record.due_date ? day(modal.record.due_date) : "—"],
                  [
                    "Trạng thái",
                    modal.record.status === "PAID" ? "Đã nhận" : "Chưa nhận",
                  ],
                ]
              : [
                  ["Tên tổ chức", modal.record.name],
                  ["Loại hình", modal.record.organization_type || "—"],
                  ["Người đại diện", modal.record.representative || "—"],
                  ["Email", modal.record.contact_email || "—"],
                  ["Số điện thoại", modal.record.contact_phone || "—"],
                  ["Địa chỉ", modal.record.address || "—"],
                  ["Ghi chú", modal.record.notes || "—"],
                  ["Trạng thái", organizationStatusLabel(modal.record.status)],
                ]
            )
              .concat([
                ["Tạo lúc", timestamp(modal.record.created_at)],
                ["Cập nhật", timestamp(modal.record.updated_at)],
                ["Phiên bản", String(modal.record.version)],
              ])
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <div className="dialog-footer">
            <Button onClick={() => setModal(null)}>Đóng</Button>
          </div>
        </Dialog>
      )}
      {modal?.kind === "backup" && (
        <Dialog
          error={error}
          title="Sao lưu dữ liệu"
          busy={busy}
          onClose={() => setModal(null)}
        >
          <p className="muted">
            Tạo bản sao SQLite nhất quán trên máy chủ. Tệp được lưu trong thư
            mục dữ liệu riêng; xem hướng dẫn quản trị để lấy tệp và phục hồi.
          </p>
          {backup && (
            <p role="status" className="preview mt-4">
              {backup.state === "COMPLETED"
                ? `Đã sao lưu: ${backup.filename}`
                : backup.state === "FAILED"
                  ? backup.message
                  : `Đang sao lưu · ${backup.state}`}
            </p>
          )}
          <div className="dialog-footer">
            <Button onClick={() => setModal(null)} disabled={busy}>
              Đóng
            </Button>
            <Button
              primary
              onClick={startBackup}
              disabled={
                !connected ||
                busy ||
                (!!backup && ["QUEUED", "RUNNING"].includes(backup.state))
              }
            >
              Tạo bản sao lưu
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
