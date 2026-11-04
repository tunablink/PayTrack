import sqlite3
from pathlib import Path
import pytest
from app.repository import Repository
from .conftest import ORIGIN, send


def test_organization_details_create_read_update(authorized):
    client,app=authorized
    fields={'name':'  Tổ chức A  ','organization_type':'  Doanh nghiệp  ','representative':'  Nguyễn Văn An  ',
            'contact_email':'  contact@example.com  ','contact_phone':'  +84 (28) 1234-5678  ',
            'address':'  123 Đường A, TP.HCM  ','notes':'  Ghi chú riêng  ','status':'INACTIVE'}
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        created=send(ws,'organization.create',fields)['data']
        for key,value in fields.items():
            assert created[key]==value.strip()
        assert send(ws,'organization.list')['data']==[created]
        updated=send(ws,'organization.update',{**{key:created[key] for key in fields},'id':created['id'],'version':1,
                                             'status':'ACTIVE','representative':'Trần Bình','contact_email':'','contact_phone':''})['data']
        assert updated['version']==2 and updated['status']=='ACTIVE'
        assert updated['representative']=='Trần Bình'
        assert updated['contact_email']==updated['contact_phone']==''
        assert updated['address']==created['address'] and updated['created_at']==created['created_at']
        assert send(ws,'organization.list')['data']==[updated]
        with app.state.repo.connect() as conn:
            assert conn.execute('SELECT organization_type FROM organizations WHERE id=?',(created['id'],)).fetchone()[0]=='Doanh nghiệp'
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute("UPDATE organizations SET status='PAID' WHERE id=?",(created['id'],))


@pytest.mark.parametrize('change',[
    {'organization_type':'x'*101},{'representative':'x'*201},{'address':'x'*501},
    {'contact_email':'not-an-email'},{'contact_email':'a b@example.com'},
    {'contact_email':'x'*250+'@example.com'},{'contact_phone':'abc'},
    {'contact_phone':'12'},{'contact_phone':'1'*51},{'status':'PAID'},
])
def test_invalid_organization_details_are_not_saved(authorized,change):
    client,app=authorized
    with client.websocket_connect('/ws',headers={'origin':ORIGIN}) as ws:
        result=send(ws,'organization.create',{'name':'Tổ chức',**change})
        assert result['error']['code']=='VALIDATION_ERROR'
        assert send(ws,'organization.list')['data']==[]


def test_migration_preserves_existing_organization_and_payment(tmp_path):
    path=tmp_path/'tracker.sqlite3'
    migrations=Path(__file__).parent.parent/'migrations'
    with sqlite3.connect(path) as conn:
        conn.executescript((migrations/'001_initial.sql').read_text(encoding='utf8')+(migrations/'002_multiple_accounts.sql').read_text(encoding='utf8')+'\nPRAGMA user_version=2;')
        conn.execute("INSERT INTO users(id,username,password_hash,is_admin) VALUES (1,'existing','test-hash',1)")
        conn.execute("INSERT INTO organizations(id,name,notes,version,user_id) VALUES (5,'Đơn vị cũ','Giữ ghi chú',3,1)")
        conn.execute("INSERT INTO payments(id,organization_id,description,quantity,unit_price,amount,work_date,status,user_id) VALUES (9,5,'Giữ công việc','1',100,100,'2026-11-04','UNPAID',1)")
        before=conn.execute('SELECT created_at,updated_at FROM organizations WHERE id=5').fetchone()
        conn.commit()
    repo=Repository(path);repo.migrate();repo.migrate()
    with repo.connect() as conn:
        record=conn.execute('SELECT * FROM organizations WHERE id=5').fetchone()
        assert record['name']=='Đơn vị cũ' and record['notes']=='Giữ ghi chú'
        assert record['version']==3 and record['user_id']==1
        assert (record['created_at'],record['updated_at'])==before
        assert record['status']=='ACTIVE'
        assert all(record[field]=='' for field in ('organization_type','representative','contact_email','contact_phone','address'))
        assert conn.execute('SELECT amount FROM payments WHERE id=9').fetchone()[0]==100
        assert conn.execute('PRAGMA user_version').fetchone()[0]==4
        assert conn.execute('SELECT due_date FROM payments WHERE id=9').fetchone()[0] is None
        assert conn.execute('PRAGMA foreign_key_check').fetchall()==[]
