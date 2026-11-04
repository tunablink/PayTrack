"use client";

import { useId, useMemo, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { money, type Summary } from "@/lib/types";
import { groupReportPeriods, type ReportGrouping } from "@/lib/reports";
import styles from "./report-charts.module.css";

type Granularity = ReportGrouping;
const compact = (value: number) => {
  const format = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
  if (value >= 1_000_000_000)
    return `${format.format(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${format.format(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${format.format(value / 1_000)} nghìn`;
  return format.format(value);
};
const percentage = (value: number, total: number) =>
  total > 0
    ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format((value / total) * 100)}%`
    : "—";
const periodLabel = (period: string) =>
  `${period.slice(5)}/${period.slice(0, 4)}`;

function axisMaximum(value: number) {
  const rough = Math.max(value / 4, 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].find((n) => n >= rough / magnitude)! * magnitude;
  return step * 4;
}

export default function ReportCharts({
  summary,
  loading,
  grouping,
  onGroupingChange,
}: {
  summary: Summary;
  loading: boolean;
  grouping?: ReportGrouping;
  onGroupingChange?: (value: ReportGrouping) => void;
}) {
  const [localGranularity, setGranularity] = useState<Granularity>("month");
  const granularity = grouping ?? localGranularity;
  const [showTotal, setShowTotal] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [focusedPeriod, setFocusedPeriod] = useState<string | null>(null);
  const chartId = useId();
  const periods = useMemo(
    () => groupReportPeriods(summary.periods, granularity),
    [summary.periods, granularity],
  );
  const organizations = useMemo(
    () =>
      [...summary.organizations].sort(
        (a, b) => b.unpaid - a.unpaid || a.name.localeCompare(b.name, "vi"),
      ),
    [summary.organizations],
  );
  const { totals } = summary;
  const selectedPeriod = focusedPeriod ?? active;
  const selected = periods.find((p) => p.period === selectedPeriod);
  const maximum = axisMaximum(
    periods.reduce(
      (max, p) =>
        Math.max(max, showTotal ? p.total : Math.max(p.paid, p.unpaid)),
      0,
    ),
  );
  const width = Math.max(560, periods.length * 68 + 82);
  const height = 280,
    left = 64,
    right = 18,
    top = 20,
    bottom = 40;
  const plotHeight = height - top - bottom;
  const step = (width - left - right) / Math.max(periods.length, 1);
  const y = (value: number) => top + plotHeight * (1 - value / maximum);
  const center = (index: number) => left + step * (index + 0.5);
  const circumference = 2 * Math.PI * 79;
  const paidFraction =
    totals.total > 0 ? Math.max(0, Math.min(1, totals.paid / totals.total)) : 0;

  function changeGranularity(value: Granularity) {
    setGranularity(value);
    onGroupingChange?.(value);
    setActive(null);
    setFocusedPeriod(null);
  }

  return (
    <div className={styles.charts} aria-busy={loading}>
      <div className={styles.grid}>
        <section
          className={styles.panel}
          aria-labelledby={`${chartId}-period-title`}
        >
          <div className={styles.heading}>
            <div>
              <h2 id={`${chartId}-period-title`}>Diễn biến dòng tiền</h2>
              <p>Đã nhận và chưa nhận theo ngày thực hiện · Đơn vị: đồng</p>
            </div>
            <div className={styles.tools}>
              <button
                type="button"
                className={`${styles.totalToggle} ${showTotal ? styles.selected : ""}`}
                aria-pressed={showTotal}
                onClick={() => setShowTotal((value) => !value)}
              >
                <TrendingUp size={15} />
                Đường tổng
              </button>
              <div
                className={styles.segmented}
                role="group"
                aria-label="Nhóm theo thời gian"
              >
                <button
                  type="button"
                  aria-pressed={granularity === "month"}
                  onClick={() => changeGranularity("month")}
                >
                  Theo tháng
                </button>
                <button
                  type="button"
                  aria-pressed={granularity === "quarter"}
                  onClick={() => changeGranularity("quarter")}
                >
                  Theo quý
                </button>
              </div>
            </div>
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.paidSwatch} />
              Đã nhận
            </span>
            <span>
              <i className={styles.unpaidSwatch} />
              Chưa nhận
            </span>
            {showTotal && (
              <span>
                <i className={styles.lineSwatch} />
                Tổng phải thu
              </span>
            )}
          </div>
          {totals.total > 0 && periods.length > 0 ? (
            <>
              <div
                className={styles.scroll}
                tabIndex={0}
                role="region"
                aria-label="Biểu đồ khoản phải thu theo thời gian; cuộn ngang để xem thêm kỳ"
              >
                <svg
                  className={styles.barChart}
                  viewBox={`0 0 ${width} ${height}`}
                  style={{ minWidth: width }}
                  aria-labelledby={`${chartId}-bar-title ${chartId}-bar-description`}
                  onMouseLeave={() => setActive(null)}
                >
                  <title id={`${chartId}-bar-title`}>
                    So sánh khoản đã nhận và chưa nhận theo{" "}
                    {granularity === "month" ? "tháng" : "quý"}
                  </title>
                  <desc id={`${chartId}-bar-description`}>
                    Màu cam là đã nhận, màu xám là chưa nhận. Các kỳ tăng dần
                    theo thời gian. Chi tiết đầy đủ nằm trong bảng đối chiếu bên
                    dưới.
                  </desc>
                  {[0, 1, 2, 3, 4].map((tick) => {
                    const value = (maximum * tick) / 4;
                    return (
                      <g key={tick}>
                        <line
                          x1={left}
                          x2={width - right}
                          y1={y(value)}
                          y2={y(value)}
                          className={styles.gridLine}
                        />
                        <text
                          x={left - 10}
                          y={y(value) + 4}
                          textAnchor="end"
                          className={styles.axis}
                        >
                          {compact(value)}
                        </text>
                      </g>
                    );
                  })}
                  {periods.map((period, index) => (
                    <g
                      key={period.period}
                      tabIndex={0}
                      role="img"
                      data-testid={`report-period-${period.period}`}
                      aria-label={`${periodLabel(period.period)}: Đã nhận ${money(period.paid)}, Chưa nhận ${money(period.unpaid)}`}
                      className={`${styles.period} ${selectedPeriod === period.period ? styles.activePeriod : ""}`}
                      onFocus={() => setFocusedPeriod(period.period)}
                      onBlur={() => setFocusedPeriod(null)}
                      onMouseEnter={() => setActive(period.period)}
                    >
                      <title>{`${periodLabel(period.period)} · Đã nhận: ${money(period.paid)} · Chưa nhận: ${money(period.unpaid)}`}</title>
                      <rect
                        x={left + index * step + 2}
                        y={top}
                        width={step - 4}
                        height={plotHeight}
                        className={styles.hoverArea}
                      />
                      <rect
                        x={center(index) - 23}
                        y={y(period.unpaid)}
                        width={20}
                        height={(plotHeight * period.unpaid) / maximum}
                        rx={3}
                        className={styles.unpaidBar}
                      />
                      <rect
                        x={center(index) + 3}
                        y={y(period.paid)}
                        width={20}
                        height={(plotHeight * period.paid) / maximum}
                        rx={3}
                        className={styles.paidBar}
                      />
                      <text
                        x={center(index)}
                        y={height - 15}
                        textAnchor="middle"
                        className={styles.axis}
                      >
                        {periodLabel(period.period)}
                      </text>
                    </g>
                  ))}
                  {showTotal && (
                    <g className={styles.totalLine}>
                      <polyline
                        points={periods
                          .map(
                            (period, index) =>
                              `${center(index)},${y(period.total)}`,
                          )
                          .join(" ")}
                        fill="none"
                      />
                      {periods.map((period, index) => (
                        <circle
                          key={period.period}
                          cx={center(index)}
                          cy={y(period.total)}
                          r={3}
                        />
                      ))}
                    </g>
                  )}
                </svg>
              </div>
              <div className={styles.readout} role="status" aria-live="polite">
                {selected ? (
                  <>
                    <strong>{periodLabel(selected.period)}</strong>
                    <span>
                      Đã nhận: <b>{money(selected.paid)}</b>
                    </span>
                    <span>
                      Chưa nhận: <b>{money(selected.unpaid)}</b>
                    </span>
                  </>
                ) : (
                  <span>
                    Di chuột hoặc dùng phím Tab để xem số tiền từng kỳ.
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className={styles.empty}>
              Chưa có giá trị khoản phải thu để hiển thị biểu đồ.
            </div>
          )}
          <p className={styles.note}>
            Chỉ hiển thị những kỳ có khoản phải thu trong bộ lọc.
          </p>
        </section>

        <section
          className={styles.panel}
          aria-labelledby={`${chartId}-status-title`}
        >
          <div className={styles.heading}>
            <div>
              <h2 id={`${chartId}-status-title`}>Phân bổ trạng thái</h2>
              <p>Tỷ trọng theo giá trị khoản phải thu</p>
            </div>
          </div>
          <div
            className={styles.donut}
            role="img"
            aria-label={`Tổng phải thu ${money(totals.total)}; Đã nhận ${money(totals.paid)}, ${percentage(totals.paid, totals.total)}; Chưa nhận ${money(totals.unpaid)}, ${percentage(totals.unpaid, totals.total)}`}
          >
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle cx={110} cy={110} r={79} className={styles.donutTrack} />
              <circle
                cx={110}
                cy={110}
                r={79}
                className={styles.donutPaid}
                strokeDasharray={`${circumference * paidFraction} ${circumference}`}
                transform="rotate(-90 110 110)"
              />
            </svg>
            <div className={styles.donutCenter}>
              <span>Tổng phải thu</span>
              <strong title={money(totals.total)}>
                {compact(totals.total)} ₫
              </strong>
              <small>{totals.count} khoản</small>
            </div>
          </div>
          {totals.count === 0 && (
            <p className={styles.noData}>Chưa có dữ liệu trong bộ lọc.</p>
          )}
          <div className={styles.statusList}>
            <div>
              <i className={styles.paidSwatch} />
              <span>
                <strong>Đã nhận</strong>
                <small>{totals.paid_count} khoản</small>
              </span>
              <span className={styles.statusAmount}>
                <strong>{money(totals.paid)}</strong>
                <small>{percentage(totals.paid, totals.total)}</small>
              </span>
            </div>
            <div>
              <i className={styles.unpaidSwatch} />
              <span>
                <strong>Chưa nhận</strong>
                <small>{totals.unpaid_count} khoản</small>
              </span>
              <span className={styles.statusAmount}>
                <strong>{money(totals.unpaid)}</strong>
                <small>{percentage(totals.unpaid, totals.total)}</small>
              </span>
            </div>
          </div>
        </section>
      </div>

      <section
        className={styles.panel}
        aria-labelledby={`${chartId}-organizations-title`}
      >
        <div className={styles.heading}>
          <div>
            <h2 id={`${chartId}-organizations-title`}>
              <BarChart3 size={17} />
              Khoản chưa nhận theo đơn vị
            </h2>
            <p>Xếp theo số tiền chưa nhận từ cao xuống thấp</p>
          </div>
          <span className={styles.rankingTotal}>
            Tổng chưa nhận: <strong>{money(totals.unpaid)}</strong>
          </span>
        </div>
        {organizations.length > 0 ? (
          <ol className={styles.ranking}>
            {organizations.map((organization) => (
              <li key={organization.id}>
                <div className={styles.rankHeader}>
                  <span className={styles.organization}>
                    <span
                      className={styles.organizationAvatar}
                      aria-hidden="true"
                    >
                      {organization.name
                        .trim()
                        .slice(0, 2)
                        .toLocaleUpperCase("vi-VN")}
                    </span>
                    <strong>{organization.name}</strong>
                    <small>{organization.unpaid_count} khoản chưa nhận</small>
                  </span>
                  <span className={styles.rankAmount}>
                    <strong>{money(organization.unpaid)}</strong>
                    <small>
                      {percentage(organization.unpaid, totals.unpaid)}
                    </small>
                  </span>
                </div>
                <div
                  className={styles.rankTrack}
                  role="img"
                  aria-label={`${organization.name}: Chưa nhận ${money(organization.unpaid)}, chiếm ${percentage(organization.unpaid, totals.unpaid)} số tiền chưa nhận`}
                >
                  <span
                    style={{
                      width: `${totals.unpaid > 0 ? (organization.unpaid / totals.unpaid) * 100 : 0}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className={styles.empty}>
            Chưa có dữ liệu đơn vị trong bộ lọc.
          </div>
        )}
      </section>
    </div>
  );
}
