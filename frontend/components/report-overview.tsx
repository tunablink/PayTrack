"use client";
import { ArrowDownLeft, ArrowUpRight, Percent, Wallet } from "lucide-react";
import { Field } from "./ui";
import { day, money, type Organization, type Summary } from "@/lib/types";
import { recoveryRate, reportModeLabels, type ReportMode } from "@/lib/reports";
import styles from "./report-overview.module.css";

type Props={summary:Summary;year:string;mode:ReportMode;partner:string;years:string[];organizations:Organization[];start:string;end:string;onYear:(value:string)=>void;onPartner:(value:string)=>void;onMode:(value:ReportMode)=>void};
export default function ReportOverview({summary,year,mode,partner,years,organizations,start,end,onYear,onPartner,onMode}:Props) {
  const ratio=summary.totals.total > 0 ? summary.totals.paid/summary.totals.total*100 : 0;
  return <>
    <div className={styles.metrics}>
      <div className="metric"><span>Tổng doanh thu hợp đồng<Wallet size={18}/></span><strong>{money(summary.totals.total)}</strong><small>{summary.totals.count} khoản trong kỳ</small></div>
      <div className="metric"><span>Tổng khoản thu đã nhận<ArrowDownLeft size={18}/></span><strong>{money(summary.totals.paid)}</strong><small><i className="dot green"/>{summary.totals.paid_count} khoản đã nhận</small></div>
      <div className="metric"><span>Dư nợ<ArrowUpRight size={18}/></span><strong className="accent">{money(summary.totals.unpaid)}</strong><small><i className="dot orange"/>{summary.totals.unpaid_count} khoản chưa nhận</small></div>
      <div className="metric"><span>Tỷ lệ thu hồi công nợ<Percent size={18}/></span><strong>{recoveryRate(summary)}</strong><div className={styles.progress} role="progressbar" aria-label="Tỷ lệ thu hồi công nợ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio}><span style={{width:`${ratio}%`}}/></div><small>Đã nhận / Tổng doanh thu hợp đồng</small></div>
    </div>
    <div className={styles.filters}>
      <Field label="Năm"><select value={year} onChange={event=>onYear(event.target.value)}>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></Field>
      <Field label="Đối tác"><select value={partner} onChange={event=>onPartner(event.target.value)}><option value="">Tất cả đối tác</option>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
      <Field label="Khoảng thời gian"><select value={mode} onChange={event=>onMode(event.target.value as ReportMode)}>{Object.entries(reportModeLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></Field>
      <p className={styles.period}>Khoảng báo cáo: {day(start)} – {day(end)}{mode==='quarter'?' · Biểu đồ theo quý':''}</p>
    </div>
  </>;
}
