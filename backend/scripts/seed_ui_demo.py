"""Append fictional UI showcase data to one account, preserving existing records."""
import argparse
import json
import sqlite3
import sys
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.repository import Repository

MARKER = '[UI-DEMO v1]'
ORGANIZATIONS = [
    ('Công ty Công nghệ Sao Mai', 'Doanh nghiệp', 'Nguyễn Minh Anh', 'sangmai', 'TP. Hồ Chí Minh', 'Đối soát theo từng giai đoạn dự án.', 'ACTIVE'),
    ('Trường Đại học Đông An', 'Trường học', 'Trần Hoài Nam', 'dongan', 'TP. Thủ Đức, TP. Hồ Chí Minh', 'Thanh toán sau khi nghiệm thu học phần.', 'ACTIVE'),
    ('Trung tâm Đào tạo Ánh Dương', 'Trung tâm đào tạo', 'Lê Thu Hà', 'anhduong', 'Quận Cầu Giấy, Hà Nội', 'Đối tác đào tạo định kỳ hàng tháng.', 'ACTIVE'),
    ('Công ty Truyền thông Mộc', 'Doanh nghiệp', 'Phạm Quang Huy', 'mocmedia', 'Quận Hải Châu, Đà Nẵng', 'Gửi hồ sơ đối soát vào ngày 25.', 'ACTIVE'),
    ('Viện Nghiên cứu Minh Triết', 'Viện nghiên cứu', 'Vũ Thanh Tâm', 'minhtriet', 'Quận Nam Từ Liêm, Hà Nội', 'Hồ sơ gồm báo cáo nghiên cứu và biên bản bàn giao.', 'ACTIVE'),
    ('Quỹ Cộng đồng Xanh', 'Tổ chức phi lợi nhuận', 'Đặng Ngọc Linh', 'congdongxanh', 'TP. Huế', 'Chương trình đào tạo kỹ năng cho cộng đồng.', 'ACTIVE'),
    ('Studio Thiết kế Lam', 'Hộ kinh doanh', 'Bùi Hải Yến', 'studiolam', 'TP. Đà Lạt, Lâm Đồng', 'Thanh toán theo từng bộ sản phẩm thiết kế.', 'ACTIVE'),
    ('Phòng Tư vấn Chuyển đổi số An Phú', 'Cơ quan nhà nước', 'Đỗ Đức Thành', 'anphu', 'TP. Cần Thơ', 'Cần đối chiếu khối lượng thực tế trước thanh toán.', 'ACTIVE'),
    ('Học viện Kỹ năng Horizon', 'Trung tâm đào tạo', 'Ngô Khánh Vy', 'horizon', 'TP. Biên Hòa, Đồng Nai', 'Đặt lịch giảng dạy và xác nhận số buổi hàng tuần.', 'ACTIVE'),
    ('Nguyễn Bảo Châu', 'Cá nhân', 'Nguyễn Bảo Châu', 'baochau', 'Quận Thanh Xuân, Hà Nội', 'Tư vấn cá nhân, ưu tiên liên hệ qua email.', 'ACTIVE'),
    ('Công ty Giải pháp Bắc Sơn', 'Doanh nghiệp', 'Hoàng Tuấn Kiệt', 'bacson', 'TP. Hải Phòng', 'Đã kết thúc hợp tác, lưu hồ sơ đối chiếu.', 'INACTIVE'),
    ('Trung tâm Ngoại ngữ Bình Minh', 'Trung tâm đào tạo', 'Dương Thảo My', 'binhminh', 'TP. Nha Trang, Khánh Hòa', 'Tạm ngừng hợp tác sau khi hoàn tất khóa học.', 'INACTIVE'),
]
ITEMS = [
    ('Thiết kế giao diện hệ thống quản lý', '1', 28500000),
    ('Giảng dạy chuyên đề lập trình ứng dụng', '24', 650000),
    ('Đào tạo kỹ năng phân tích dữ liệu', '12', 850000),
    ('Tư vấn chiến lược truyền thông quý', '1', 18750000),
    ('Biên soạn tài liệu và báo cáo nghiên cứu', '6', 1250000),
    ('Workshop kỹ năng số cho cộng đồng', '4', 1850000),
    ('Thiết kế bộ nhận diện thương hiệu', '1', 12800000),
    ('Tư vấn triển khai quy trình số hóa', '8', 1500000),
    ('Hướng dẫn thực hành và chấm bài dự án', '36', 180000),
    ('Tư vấn kiến trúc và tối ưu ứng dụng', '7.5', 800000),
    ('Bảo trì và nâng cấp cổng thông tin', '1', 9600000),
    ('Biên soạn ngân hàng câu hỏi đánh giá', '120', 65000),
]


def shift_month(day, offset):
    index = day.year * 12 + day.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def build_payments(today):
    records = []
    # Twelve completed months give annual, quarter and rolling-six-month reports depth.
    for offset in range(-12, 0):
        month = shift_month(today, offset)
        for index in range(8 + offset % 4):
            partner = (index + offset) % 12
            title, quantity, price = ITEMS[partner]
            work = month.replace(day=3 + (index * 3) % 24)
            paid = index % 5 != (offset % 5)
            amount_price = price + ((index + offset) % 3) * 75000
            due = work + timedelta(days=12 + index % 4 * 3)
            records.append((partner, f'{title} · đợt {work.month:02d}/{work.year}', quantity, amount_price, work, due, 'PAID' if paid else 'UNPAID', work + timedelta(days=5 + index % 7)))
    # Twenty-four current-month items: a mix of values, categories and deadlines.
    for index in range(24):
        partner = index % 10
        title, quantity, price = ITEMS[partner]
        work = today.replace(day=max(1, today.day - index % 4))
        paid = index % 3 != 0
        if index == 21:
            due = None
        elif not paid and index % 2 == 0:
            due = today - timedelta(days=2 + index % 17)
        elif index % 11 == 0:
            due = None
        else:
            due = today + timedelta(days=2 + index % 14)
        records.append((partner, f'{title} · {"bàn giao" if index < 12 else "nghiệm thu"} tháng {today.month:02d}', quantity, price + index % 4 * 125000, work, due, 'PAID' if paid else 'UNPAID', today - timedelta(days=index % max(1, min(today.day, 4)))))
    return records


def seed(database, username, today):
    repo = Repository(database)
    with repo.connect() as conn:
        user = conn.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
        if user is None:
            raise SystemExit('Target account does not exist.')
        if conn.execute('SELECT 1 FROM organizations WHERE user_id=? AND notes LIKE ?', (user['id'], MARKER + '%')).fetchone():
            return {'status': 'already_seeded', 'username': username}
        if conn.execute('PRAGMA user_version').fetchone()[0] < 4:
            raise SystemExit('Restart backend to apply migrations before seeding.')
        backup_dir = Path(database).parent / 'backups'
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / f'pre-ui-demo-{datetime.now().strftime("%Y%m%d-%H%M%S-%f")}.sqlite3'
        with closing(sqlite3.connect(backup)) as target:
            conn.backup(target)
        conn.execute('BEGIN IMMEDIATE')
        try:
            ids = []
            for index, (name, kind, representative, email, address, notes, status) in enumerate(ORGANIZATIONS):
                result = conn.execute('INSERT INTO organizations(name,organization_type,representative,contact_email,contact_phone,address,notes,status,user_id) VALUES (?,?,?,?,?,?,?,?,?)',
                    (name, kind, representative, f'{email}@example.com', f'090000{index + 101:04d}', address, f'{MARKER} Dữ liệu minh họa hư cấu. {notes}', status, user['id']))
                ids.append(result.lastrowid)
            records = build_payments(today)
            for index, (partner, description, quantity, price, work, due, status, updated) in enumerate(records):
                amount = int((Decimal(quantity) * price).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
                created_at = f'{work.isoformat()}T02:00:00.000Z'
                updated_at = f'{updated.isoformat()}T{2 + index % 8:02d}:{index % 6 * 10:02d}:00.000Z'
                conn.execute('INSERT INTO payments(organization_id,description,quantity,unit_price,amount,work_date,due_date,status,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    (ids[partner], description, quantity, price, amount, work.isoformat(), due.isoformat() if due else None, status, user['id'], created_at, updated_at))
            assert conn.execute('PRAGMA foreign_key_check').fetchall() == []
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        return {'status': 'created', 'username': username, 'organizations_added': len(ids), 'payments_added': len(records), 'current_month_payments': 24, 'backup': str(backup)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--username', required=True)
    parser.add_argument('--database', type=Path, default=Path(__file__).resolve().parents[2] / 'data' / 'tracker.sqlite3')
    args = parser.parse_args()
    today = datetime.now(timezone(timedelta(hours=7))).date()
    print(json.dumps(seed(args.database.resolve(), args.username, today), ensure_ascii=False))


if __name__ == '__main__':
    main()
