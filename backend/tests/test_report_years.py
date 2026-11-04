from .conftest import ORIGIN, send, create_org, create_payment


def test_report_years_are_distinct_and_sorted(authorized):
    client, _ = authorized
    with client.websocket_connect('/ws', headers={'origin': ORIGIN}) as ws:
        assert send(ws, 'report.years')['data'] == []
        org = create_org(ws)
        for date in ['2024-02-01', '2026-01-01', '2024-09-01', '2025-03-01']:
            assert create_payment(ws, org['id'], work_date=date)['success']
        assert send(ws, 'report.years')['data'] == ['2026', '2025', '2024']
