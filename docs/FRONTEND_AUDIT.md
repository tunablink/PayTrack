# Inventory and Migration Decisions

The complete `README.md`, four HTML files, and DESIGN.md were reviewed. The source did not contain `README_UPDATED.md`. Decisions in the attached request take precedence over the old README.

## Source Files

| Directory | Files | Content |
| --- | --- | --- |
| personal_payment_tracking_system_dashboard | code.html, screen.png | Dashboard, KPIs, recent table, sample history, and reminders |
| qu_n_l_t_ch_c_paytrack | code.html, screen.png | Organization table, search, and add-organization modal |
| qu_n_l_kho_n_thu_minimalist_paytrack | code.html, screen.png | Payment table, filters, and edit/mark-paid actions |
| b_o_c_o_ph_n_t_ch_t_i_ch_nh_paytrack | code.html, screen.png | Summaries, charts, and report-export modal |
| warm_financial_atelier | DESIGN.md | Colors, typography, spacing, and design guidance |

Total: **4 HTML files, 4 PNG files, and 1 Markdown file**. There are no separate CSS/JS/font/icon binaries. CSS and JavaScript are embedded in HTML. Google Fonts includes Be Vietnam Pro and Plus Jakarta Sans; Material Symbols is requested repeatedly. The dashboard uses inline SVG; PNGs are reference screenshots rather than business images. All four screens load Tailwind from a runtime CDN. `scripts/audit.cjs` reads all HTML files to inventory text, scripts, and links.

## Assessment

| Element | Decision | Reason |
| --- | --- | --- |
| PayTrack branding, orange palette, light background, left navigation | Retain and refine | The identity and structure fit a management application |
| Four screens, KPIs, tables, filters, and dialog flows | Convert to Next.js/React | Use shared TypeScript components and real WebSocket data |
| Be Vietnam Pro font | Retain and self-host through npm | Supports Vietnamese characters and removes the runtime CDN dependency |
| Material Symbols and scattered SVGs | Replace with Lucide | Consistent strokes and sizes without downloading an icon font |
| Repeated header/sidebar and fixed desktop dimensions | Adjust | One shared shell, bottom navigation on mobile, and tables scrolling within their own containers |
| Total revenue, banking, taxes, overdue, Pending, and outgoing payments | Remove | Outside the two-state PAID/UNPAID business scope |
| Fake Excel/PDF/JSON export, debt-reminder email, settings, and help | Remove | No backend implementation; export reports success through an alert without producing a file |
| 2024 charts, growth rates, creditworthiness, and banking figures | Remove | All are hardcoded or inferred beyond the scope |
| Organization/month report tables | Retain and connect to real data | Support direct reconciliation without decorative charts |
| Class/DOM manipulation, onclick handlers, and parseFloat money calculations | Replace | React state; backend Decimal with HALF_UP rounding; frontend preview using BigInt |
| Login and SQLite backup | Add | New required features; backup is real I/O work in a thread pool |

## Issues Found in the Source

- Sidebar items use `href="#"`; the dashboard uses `#details`, with no real routing system.
- The payments screen calls `addReceivableModal` and `markPaidModal`, but the corresponding dialogs are missing from the document.
- Submitting the organization form only closes the modal without saving data.
- Filters, pagination, table/card view selection, and many detail/edit actions are not connected to business logic.
- Reports switch month/quarter views by changing button classes without recalculating statistics.
- Icon fonts are declared repeatedly, scrollbars are hidden globally, and select-none prevents copying figures; one screen has fixed width/height and overflow hidden.
- Totals, row counts, and statuses are inconsistent across screens.

The `stitch_javafx_payment_tracker_dashboard/` directory was preserved. Migration did not use iframes or dangerouslySetInnerHTML.

Update on 3 November 2026: following the project owner's subsequent request, the interface font was changed from Be Vietnam Pro to self-hosted Inter. The font-retention comments above record the original migration decision.
