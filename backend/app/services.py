from decimal import Decimal, ROUND_HALF_UP
from .registry import DomainError, Registry
from . import schemas as s

registry = Registry()


def row(conn, table, identity):
    item = conn.execute(f'SELECT * FROM {table} WHERE id=?', (identity.id,)).fetchone()
    if not item:
        raise DomainError('NOT_FOUND', 'Bản ghi không còn tồn tại.')
    if item['version'] != identity.version:
        raise DomainError('CONFLICT', 'Dữ liệu đã được thay đổi ở tab khác. Hãy tải lại trước khi sửa.')
    return dict(item)


def organization_exists(conn, org_id):
    if not conn.execute('SELECT 1 FROM organizations WHERE id=?', (org_id,)).fetchone():
        raise DomainError('VALIDATION_ERROR', 'Đơn vị không tồn tại.')


def payment_values(payload):
    amount = int((payload.quantity * Decimal(payload.unit_price)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    if amount > 1000000000000000:
        raise DomainError('VALIDATION_ERROR', 'Thành tiền vượt giới hạn 1.000.000.000.000.000 đồng.')
    return (payload.organization_id, payload.description, str(payload.quantity), payload.unit_price,
            amount, payload.work_date.isoformat(), payload.status)


def validate_portfolio_total(conn, amount, previous=0):
    total = conn.execute('SELECT coalesce(sum(amount),0) FROM payments').fetchone()[0]
    if total - previous + amount > 9007199254740991:
        raise DomainError('VALIDATION_ERROR', 'Tổng danh mục vượt giới hạn số nguyên an toàn 9.007.199.254.740.991 đồng.')


@registry.action('organization.list', s.Empty)
def organizations(ctx, payload):
    return [dict(r) for r in ctx.conn.execute('SELECT * FROM organizations ORDER BY name COLLATE NOCASE,id')]


@registry.action('organization.create', s.Organization, write=True)
def create_organization(ctx, payload):
    cur = ctx.conn.execute('INSERT INTO organizations(name,notes) VALUES (?,?)', (payload.name, payload.notes))
    return dict(ctx.conn.execute('SELECT * FROM organizations WHERE id=?', (cur.lastrowid,)).fetchone())


@registry.action('organization.update', s.OrganizationUpdate, write=True)
def update_organization(ctx, payload):
    row(ctx.conn, 'organizations', payload)
    ctx.conn.execute("UPDATE organizations SET name=?,notes=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", (payload.name,payload.notes,payload.id))
    return dict(ctx.conn.execute('SELECT * FROM organizations WHERE id=?', (payload.id,)).fetchone())


@registry.action('organization.delete', s.Identity, write=True)
def delete_organization(ctx, payload):
    row(ctx.conn, 'organizations', payload)
    if ctx.conn.execute('SELECT 1 FROM payments WHERE organization_id=? LIMIT 1', (payload.id,)).fetchone():
        raise DomainError('ORGANIZATION_IN_USE', 'Không thể xóa đơn vị còn khoản phải thu.')
    ctx.conn.execute('DELETE FROM organizations WHERE id=?', (payload.id,))
    return {'deleted': payload.id}


def where(filters):
    terms, args = [], []
    for field, op, value in [('organization_id','=',filters.organization_id), ('status','=',filters.status),
                             ('work_date','>=',filters.start_date), ('work_date','<=',filters.end_date)]:
        if value is not None:
            terms.append(f'p.{field} {op} ?')
            args.append(value.isoformat() if hasattr(value, 'isoformat') else value)
    if filters.search:
        terms.append('instr(casefold(p.description),casefold(?)) > 0')
        args.append(filters.search)
    return (' WHERE ' + ' AND '.join(terms) if terms else ''), args


@registry.action('payment.list', s.Filters)
def list_payments(ctx, payload):
    clause, args = where(payload)
    total = ctx.conn.execute('SELECT count(*) FROM payments p'+clause, args).fetchone()[0]
    items = [dict(r) for r in ctx.conn.execute('SELECT p.*,o.name AS organization_name FROM payments p JOIN organizations o ON o.id=p.organization_id'+clause+' ORDER BY p.work_date DESC,p.id DESC LIMIT ? OFFSET ?', args+[payload.page_size,(payload.page-1)*payload.page_size])]
    return {'items': items, 'total': total, 'page': payload.page, 'page_size': payload.page_size}


@registry.action('payment.create', s.Payment, write=True)
def create_payment(ctx, payload):
    organization_exists(ctx.conn, payload.organization_id)
    values = payment_values(payload)
    validate_portfolio_total(ctx.conn, values[4])
    cur = ctx.conn.execute('INSERT INTO payments(organization_id,description,quantity,unit_price,amount,work_date,status) VALUES (?,?,?,?,?,?,?)', values)
    return dict(ctx.conn.execute('SELECT * FROM payments WHERE id=?', (cur.lastrowid,)).fetchone())


@registry.action('payment.update', s.PaymentUpdate, write=True)
def update_payment(ctx, payload):
    previous = row(ctx.conn, 'payments', payload)
    organization_exists(ctx.conn, payload.organization_id)
    values = payment_values(payload)
    validate_portfolio_total(ctx.conn, values[4], previous['amount'])
    ctx.conn.execute("UPDATE payments SET organization_id=?,description=?,quantity=?,unit_price=?,amount=?,work_date=?,status=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", values+(payload.id,))
    return dict(ctx.conn.execute('SELECT * FROM payments WHERE id=?', (payload.id,)).fetchone())


@registry.action('payment.updateStatus', s.Status, write=True)
def update_status(ctx, payload):
    row(ctx.conn, 'payments', payload)
    ctx.conn.execute("UPDATE payments SET status=?,version=version+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?", (payload.status,payload.id))
    return dict(ctx.conn.execute('SELECT * FROM payments WHERE id=?', (payload.id,)).fetchone())


@registry.action('payment.delete', s.Identity, write=True)
def delete_payment(ctx, payload):
    row(ctx.conn, 'payments', payload)
    ctx.conn.execute('DELETE FROM payments WHERE id=?', (payload.id,))
    return {'deleted': payload.id}


TOTALS = "count(*) AS count,coalesce(sum(amount),0) AS total,coalesce(sum(CASE WHEN status='PAID' THEN amount ELSE 0 END),0) AS paid,coalesce(sum(CASE WHEN status='UNPAID' THEN amount ELSE 0 END),0) AS unpaid,coalesce(sum(status='PAID'),0) AS paid_count,coalesce(sum(status='UNPAID'),0) AS unpaid_count"


@registry.action('dashboard.summary', s.Filters)
@registry.action('report.summary', s.Filters)
def summary(ctx, payload):
    clause, args = where(payload)
    totals = dict(ctx.conn.execute('SELECT '+TOTALS+' FROM payments p'+clause, args).fetchone())
    by_org = [dict(r) for r in ctx.conn.execute('SELECT o.id,o.name,'+TOTALS+' FROM payments p JOIN organizations o ON o.id=p.organization_id'+clause+' GROUP BY o.id ORDER BY total DESC,o.id', args)]
    by_period = [dict(r) for r in ctx.conn.execute("SELECT substr(work_date,1,7) AS period,"+TOTALS+' FROM payments p'+clause+' GROUP BY period ORDER BY period DESC', args)]
    return {'totals': totals, 'organizations': by_org, 'periods': by_period}


@registry.action('system.ping', s.Empty)
def ping(ctx, payload):
    return {'pong': True}


@registry.action('backup.start', s.Empty, write=True)
def backup_start(ctx, payload):
    return ctx.executor.start()


@registry.action('backup.status', s.JobId)
def backup_status(ctx, payload):
    return ctx.executor.status(payload.job_id)
