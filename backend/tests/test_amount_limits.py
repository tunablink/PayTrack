from .conftest import ORIGIN,send,create_org,create_payment


def test_portfolio_stays_exact_in_json(authorized):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        org=create_org(ws)
        for _ in range(9):
            assert create_payment(ws,org['id'],quantity='1000',unit_price=1000000000000)['success']
        result=create_payment(ws,org['id'],quantity='1000',unit_price=1000000000000)
        assert result['error']['code']=='VALIDATION_ERROR'
        totals=send(ws,'dashboard.summary')['data']['totals']
        assert totals['total']==9000000000000000 and totals['count']==9
