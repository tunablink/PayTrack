"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, Bell, Building2, Check, ChevronLeft, ChevronRight, Clock3, Download, Plus, ReceiptText, Wallet } from "lucide-react";
import { day, money, type Payment, type PaymentList } from "@/lib/types";
import { localReportDate } from "@/lib/reports";
import styles from "./dashboard.module.css";

type Props = {
  connected: boolean; busy: boolean; revision: number; organizationCount: number;
  loadPayments: (payload: Record<string, unknown>) => Promise<PaymentList>;
  onAddPayment: () => void; onAddOrganization: () => void; onDetail: (payment: Payment) => void;
};
type Range = "week" | "month" | "quarter";
function dateText(date: Date) { return date.toISOString().slice(0, 10); }
function periodDates(month: string, range: Range) {
  const [year, value] = month.split("-").map(Number);
  const today = localReportDate();
  const endOfMonth = new Date(Date.UTC(year, value, 0));
  if (range === "quarter") {
    const first = Math.floor((value - 1) / 3) * 3;
    return { start_date: dateText(new Date(Date.UTC(year, first, 1))), end_date: dateText(new Date(Date.UTC(year, first + 3, 0))) };
  }
  if (range === "week") {
    const end = month === `${today.year}-${today.month}` ? new Date(`${today.year}-${today.month}-${today.day}T00:00:00Z`) : endOfMonth;
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
    return { start_date: dateText(start), end_date: dateText(end) };
  }
  return { start_date: `${month}-01`, end_date: dateText(endOfMonth) };
}
const percentage = (value: number, total: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(total > 0 ? value / total * 100 : 0) + "%";

export default function Dashboard({ connected, busy, revision, organizationCount, loadPayments, onAddPayment, onAddOrganization, onDetail }: Props) {
  const [month] = useState(() => { const today = localReportDate(); return `${today.year}-${today.month}`; });
  const [range, setRange] = useState<Range>("month");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [snapshot, setSnapshot] = useState<{ items: Payment[]; key: string; updated: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const dates = useMemo(() => periodDates(month, range), [month, range]);
  const key = JSON.stringify(dates);
  useEffect(() => {
    if (!connected) return;
    const current = ++sequence.current;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError("");
      const first = await loadPayments({ ...dates, page: 1, page_size: 100 });
      const items = [...first.items];
      for (let next = 2; next <= Math.ceil(first.total / 100); next++) {
        if (!active) return;
        const result = await loadPayments({ ...dates, page: next, page_size: 100 });
        items.push(...result.items);
      }
      if (active && current === sequence.current) setSnapshot({ items, key, updated: new Date() });
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Không thể tải tổng quan."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [connected, revision, loadPayments, dates, key]);
  const items = snapshot?.items ?? [];
  const paid = items.filter(item => item.status === "PAID");
  const unpaid = items.filter(item => item.status === "UNPAID");
  const today = localReportDate();
  const todayText = `${today.year}-${today.month}-${today.day}`;
  const overdue = unpaid.filter(item => item.due_date && item.due_date < todayText);
  const due = unpaid.filter(item => item.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const sum = (records: Payment[]) => records.reduce((total, item) => total + item.amount, 0);
  const total = sum(items), received = sum(paid);
  const rate = total > 0 ? received / total * 100 : 0;
  const history = [...paid].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  const partners = new Map<number, { name: string; amount: number }>();
  items.forEach(item => partners.set(item.organization_id, { name: item.organization_name, amount: (partners.get(item.organization_id)?.amount ?? 0) + item.amount }));
  const ranking = [...partners.entries()].sort((a, b) => b[1].amount - a[1].amount);
  const filtered = status === "ALL" ? items : items.filter(item => item.status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / 4));
  const currentPage = Math.min(page, pages);
  const visibleItems = filtered.slice((currentPage - 1) * 4, currentPage * 4);
  const ready = Boolean(snapshot && snapshot.key === key && !loading);
  function exportReport() {
    if (!ready) return;
    const rows = [
      ["BÁO CÁO TỔNG QUAN", `${day(dates.start_date)} – ${day(dates.end_date)}`],
      ["Tổng khoản phải thu", total], ["Đã nhận", received], ["Chưa nhận", sum(unpaid)], ["Quá hạn", sum(overdue)], [],
      ["Đơn vị", "Hạng mục", "Số lượng", "Đơn giá", "Tổng tiền", "Hạn TT", "Trạng thái"],
      ...items.map(item => [item.organization_name, item.description, item.quantity, item.unit_price, item.amount, item.due_date ?? "", item.status === "PAID" ? "Đã nhận" : "Chưa nhận"]),
    ];
    const csv = "\uFEFF" + rows.map(row => row.map(value => {
      let text = String(value);
      if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `tong-quan-${month}-${range}.csv`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className={styles.dashboard} aria-busy={loading}>
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>KHÔNG GIAN TÀI CHÍNH CÁ NHÂN</p><h1>Theo dõi khoản thu</h1></div>
    </div>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    <div className={styles.topGrid}>
      <section className={styles.hero} aria-label="Tổng khoản phải thu">
        <div className={styles.heroTop}><span><Wallet size={14} /> Tổng khoản phải thu</span><small>{snapshot ? `Cập nhật ${snapshot.updated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Đang tải dữ liệu…"}</small></div>
        <strong className={styles.heroAmount}>{snapshot ? money(total) : "—"}</strong>
        <div className={styles.heroProgress} role="progressbar" aria-label="Tiến độ thu hồi" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${rate}%` }} /></div>
        <div className={styles.heroCaption}><span>Đã thu {percentage(received, total)} tổng giá trị</span><span>{items.length} khoản trong kỳ</span></div>
        <div className={styles.heroActions}><button disabled={!connected || busy || !organizationCount} onClick={onAddPayment}><Plus size={16} />Thêm khoản thu mới</button><button disabled={!ready} onClick={exportReport}><Download size={16} />Xuất báo cáo Excel</button></div>
      </section>
      <section className={styles.card} aria-label="Trạng thái dòng tiền">
        <div className={styles.cardHeading}><h2>Trạng thái dòng tiền</h2><div className={styles.tabs}>{([["week", "Tuần"], ["month", "Tháng"], ["quarter", "Quý"]] as const).map(([value, label]) => <button key={value} aria-pressed={range === value} onClick={() => { setRange(value); setPage(1); }}>{label}</button>)}</div></div>
        {([{ label: "Đã nhận thanh toán", records: paid, icon: Check }, { label: "Còn phải thu / Tồn đọng", records: unpaid, icon: Clock3 }, { label: "Trong đó: khoản quá hạn", records: overdue, icon: Bell }]).map(({ label, records, icon: Icon }) => <div className={styles.cashRow} key={label}><span className={styles.icon}><Icon size={17} /></span><div><p>{label}</p><strong>{snapshot ? money(sum(records)) : "—"}</strong></div><span className={styles.chip}>{records.length} khoản</span></div>)}
        <div className={styles.cardFooter}><span>Tỷ lệ thu hồi: <strong>{percentage(received, total)}</strong></span><Link href="/reports">Xem đối soát <ArrowRight size={14} /></Link></div>
      </section>
    </div>
    <div className={styles.sectionHeading}><h2>Thao tác nhanh &amp; Nhắc nhở</h2><span>{due.length} khoản có hạn cần theo dõi</span></div>
    <div className={styles.quickGrid}>
      <section className={styles.quickCard}><div className={styles.quickTop}><span className={styles.icon}><Bell size={18} /></span><span className={styles.chip}>{overdue.length ? `${overdue.length} khoản quá hạn` : "Nhắc thanh toán"}</span></div><h3>{due[0]?.organization_name ?? "Theo dõi hạn thanh toán"}</h3><p>{due[0] ? `${due[0].description} · Hạn ${day(due[0].due_date!)} · ${money(due[0].amount)}` : "Không có khoản chưa nhận có hạn thanh toán trong kỳ."}</p><button disabled={!due[0]} onClick={() => due[0] && onDetail(due[0])}>Xem khoản cần thu <ArrowRight size={14} /></button></section>
      <section className={styles.quickCard}><div className={styles.quickTop}><span className={styles.icon}><ReceiptText size={18} /></span><span className={styles.chip}>Ghi nhận khoản thu</span></div><h3>Thêm hạng mục mới</h3><p>Tạo khoản thu, tính thành tiền và đặt hạn thanh toán để theo dõi.</p><button disabled={!connected || busy || !organizationCount} onClick={onAddPayment}><Plus size={14} />Thêm khoản thu mới</button></section>
      <section className={styles.quickCard}><div className={styles.quickTop}><span className={styles.icon}><Building2 size={18} /></span><span className={styles.chip}>{organizationCount} đơn vị</span></div><h3>Thêm đơn vị / Khách hàng</h3><p>Quản lý thông tin tổ chức, người đại diện và thông tin liên hệ.</p><button disabled={!connected || busy} onClick={onAddOrganization}><Plus size={14} />Thêm đơn vị mới</button></section>
    </div>
    <div className={styles.bottomGrid}>
      <section className={`${styles.card} ${styles.recent}`} aria-label="Khoản thu gần đây">
        <div className={styles.cardHeading}><div><h2>Khoản thu gần đây</h2><p className={styles.muted}>Danh sách hạng mục và tiến độ thanh toán trong kỳ.</p></div><div className={styles.tabs}>{[["ALL", `Tất cả (${items.length})`], ["UNPAID", `Chưa nhận (${unpaid.length})`], ["PAID", `Đã nhận (${paid.length})`]].map(([value, label]) => <button key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Đơn vị / Đối tác</th><th>Hạng mục</th><th>Số tiền</th><th>Hạn TT</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{visibleItems.map(item => <tr key={item.id}><td><div className={styles.partner}><span>{item.organization_name.slice(0, 2).toLocaleUpperCase("vi")}</span><strong>{item.organization_name}</strong></div></td><td>{item.description}</td><td className={styles.amount}>{money(item.amount)}</td><td className={styles.nowrap}>{item.due_date ? day(item.due_date) : "—"}</td><td><span className={styles.chip}>{item.status === "PAID" ? "Đã nhận" : item.due_date && item.due_date < todayText ? "Quá hạn" : "Chưa nhận"}</span></td><td><button className={styles.detail} aria-label={`Xem ${item.description}`} onClick={() => onDetail(item)}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>
        {!filtered.length && <p className={styles.empty}>{loading ? "Đang tải khoản thu…" : "Chưa có khoản thu phù hợp trong kỳ."}</p>}
        <div className={styles.cardFooter}><span>Hiển thị {visibleItems.length} / {filtered.length} khoản</span><div className={styles.pagination}><button aria-label="Trang trước" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={14} /></button><span>{currentPage} / {pages}</span><button aria-label="Trang sau" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={14} /></button><Link href="/payments">Tất cả <ArrowRight size={13} /></Link></div></div>
      </section>
      <div className={styles.sideStack}>
        <section className={styles.card} aria-label="Lịch sử nhận tiền"><div className={styles.cardHeading}><h2>Lịch sử nhận tiền</h2><Link href="/payments">Tất cả <ArrowRight size={13} /></Link></div><p className={styles.muted}>Khoản đã nhận, theo lần cập nhật gần nhất.</p>{history.map(item => <button className={styles.historyRow} key={item.id} onClick={() => onDetail(item)}><span className={styles.icon}><ArrowDownLeft size={15} /></span><span><strong>{item.organization_name}</strong><small>Cập nhật {day(item.updated_at.slice(0, 10))}</small></span><b>+{money(item.amount)}</b></button>)}{!history.length && <p className={styles.empty}>Chưa có khoản đã nhận trong kỳ.</p>}</section>
        <section className={styles.card} aria-label="Tỷ trọng doanh thu"><div className={styles.cardHeading}><h2>Tỷ trọng doanh thu</h2><span className={styles.muted}>{ranking.length} đối tác</span></div>{ranking.slice(0, 5).map(([id, partner]) => <div className={styles.ranking} key={id}><div><span>{partner.name}</span><strong>{money(partner.amount)} <small>({percentage(partner.amount, total)})</small></strong></div><div className={styles.track}><span style={{ width: `${total > 0 ? partner.amount / total * 100 : 0}%` }} /></div></div>)}{!ranking.length && <p className={styles.empty}>Chưa có dữ liệu doanh thu trong kỳ.</p>}<div className={styles.cardFooter}><span>Tính trên tổng giá trị khoản thu</span><Link href="/reports"><ArrowRight size={14} /></Link></div></section>
      </div>
    </div>
    <p className={styles.footnote}>Tiền tệ VND · Quá hạn dựa trên Hạn TT của khoản chưa nhận · Tự cập nhật mỗi 15 giây</p>
  </div>;
}
