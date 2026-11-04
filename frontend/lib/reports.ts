import type { Summary } from "./types";

export type ReportMode = "six_months" | "quarter" | "year";
export type ReportGrouping = "month" | "quarter";
export const reportModeLabels: Record<ReportMode,string> = {
  six_months:"6 tháng gần nhất", quarter:"Theo quý", year:"Cả năm",
};
export function localReportDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  return Object.fromEntries(parts.map(part=>[part.type,part.value])) as Record<'year'|'month'|'day',string>;
}
export function reportDateRange(year:string,mode:ReportMode,now = new Date()) {
  const today = localReportDate(now);
  if(mode !== 'six_months') return {start_date:`${year}-01-01`,end_date:`${year}-12-31`};
  const current = year === today.year;
  const month = current ? Number(today.month) : 12;
  const firstMonth = Number(year)*12 + month - 1 - 5;
  return {
    start_date:`${Math.floor(firstMonth/12).toString().padStart(4,'0')}-${(firstMonth%12+1).toString().padStart(2,'0')}-01`,
    end_date:current ? `${year}-${today.month}-${today.day}` : `${year}-12-31`,
  };
}
export const recoveryRate = (summary:Summary) => summary.totals.total > 0
  ? new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(summary.totals.paid/summary.totals.total*100)+'%'
  : '0%';

export function groupReportPeriods(periods:Summary['periods'], grouping:ReportGrouping):Summary['periods'] {
  const grouped = new Map<string,Summary['periods'][number]>();
  for(const item of periods) {
    const key = grouping==='month' ? item.period : `${item.period.slice(0,4)}-Q${Math.ceil(Number(item.period.slice(5))/3)}`;
    const previous = grouped.get(key);
    grouped.set(key,previous ? {
      period:key,total:previous.total+item.total,paid:previous.paid+item.paid,unpaid:previous.unpaid+item.unpaid,
      count:previous.count+item.count,paid_count:previous.paid_count+item.paid_count,unpaid_count:previous.unpaid_count+item.unpaid_count,
    } : {...item,period:key});
  }
  return [...grouped.values()].sort((a,b)=>a.period.localeCompare(b.period));
}

export function downloadReport(summary:Summary,context:{year:string;mode:ReportMode;partner:string;start_date:string;end_date:string}) {
  const rows:(string|number)[][] = [
    ['BÁO CÁO KHOẢN PHẢI THU'],['Năm',context.year],['Đối tác',context.partner],['Chế độ',reportModeLabels[context.mode]],
    ['Từ ngày',context.start_date],['Đến ngày',context.end_date],[],
    ['Chỉ tiêu','Giá trị'],['Tổng doanh thu hợp đồng',summary.totals.total],['Tổng khoản thu đã nhận',summary.totals.paid],
    ['Dư nợ',summary.totals.unpaid],['Tỷ lệ thu hồi công nợ',recoveryRate(summary)],[],
    ['ĐỐI CHIẾU THEO ĐỐI TÁC'],['Đối tác','Số khoản','Đã nhận (số khoản)','Chưa nhận (số khoản)','Tổng doanh thu hợp đồng (VND)','Tổng khoản thu đã nhận (VND)','Dư nợ (VND)'],
    ...summary.organizations.map(org=>[org.name,org.count,org.paid_count,org.unpaid_count,org.total,org.paid,org.unpaid]),[],
    [context.mode==='quarter'?'ĐỐI CHIẾU THEO QUÝ':'ĐỐI CHIẾU THEO THÁNG'],
    ['Kỳ','Số khoản','Đã nhận (số khoản)','Chưa nhận (số khoản)','Tổng doanh thu hợp đồng (VND)','Tổng khoản thu đã nhận (VND)','Dư nợ (VND)'],
    ...groupReportPeriods(summary.periods,context.mode==='quarter'?'quarter':'month').map(period=>[period.period,period.count,period.paid_count,period.unpaid_count,period.total,period.paid,period.unpaid]),
  ];
  const cell = (value:string|number) => {
    let text=String(value);
    if(typeof value==='string' && /^[\s]*[=+@-]/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  const content='\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=`bao-cao-${context.year}-${context.mode}.csv`;
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
