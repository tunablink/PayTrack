import pytest
from .conftest import ORIGIN, send, create_org, create_payment


def test_payment_due_date_is_saved_updated_cleared_and_independent(authorized):
    client, app = authorized
    with client.websocket_connect('/ws', headers={'origin': ORIGIN}) as ws:
        org = create_org(ws)
        created = create_payment(ws, org['id'], due_date='2026-12-15')['data']
        assert created['due_date'] == '2026-12-15'
        assert created['work_date'] == '2026-11-02'
        assert send(ws, 'payment.list')['data']['items'][0]['due_date'] == '2026-12-15'
        payload = {key: created[key] for key in ('id', 'version', 'organization_id', 'description', 'quantity', 'unit_price', 'work_date', 'status', 'due_date')}
        updated = send(ws, 'payment.update', {**payload, 'due_date': '2027-01-10'})['data']
        assert updated['due_date'] == '2027-01-10'
        assert send(ws, 'report.summary')['data']['periods'][0]['period'] == '2026-11'
        status = send(ws, 'payment.updateStatus', {'id': updated['id'], 'version': updated['version'], 'status': 'PAID'})['data']
        assert status['due_date'] == '2027-01-10'
        cleared = send(ws, 'payment.update', {**payload, 'version': status['version'], 'status': 'PAID', 'due_date': None})['data']
        assert cleared['due_date'] is None
        assert create_payment(ws, org['id'])['data']['due_date'] is None
        with app.state.repo.connect() as conn:
            assert conn.execute('SELECT due_date FROM payments WHERE id=?', (created['id'],)).fetchone()[0] is None


@pytest.mark.parametrize('due_date', ['2026-02-30', 'invalid-date', ''])
def test_invalid_payment_due_date_is_rejected(authorized, due_date):
    client, _ = authorized
    with client.websocket_connect('/ws', headers={'origin': ORIGIN}) as ws:
        org = create_org(ws)
        assert create_payment(ws, org['id'], due_date=due_date)['error']['code'] == 'VALIDATION_ERROR'
        assert send(ws, 'payment.list')['data']['total'] == 0
