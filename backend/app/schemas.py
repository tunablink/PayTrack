from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class Schema(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Empty(Schema):
    pass


class Login(Schema):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=False)
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=1024)


class Organization(Schema):
    name: str = Field(min_length=1, max_length=200)
    notes: str = Field(default='', max_length=2000)


class Identity(Schema):
    id: int = Field(gt=0, strict=True)
    version: int = Field(gt=0, strict=True)


class OrganizationUpdate(Organization, Identity):
    pass


class Payment(Schema):
    organization_id: int = Field(gt=0, strict=True)
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(gt=0, le=1000000, decimal_places=3, allow_inf_nan=False)
    unit_price: int = Field(ge=0, le=1000000000000, strict=True)
    work_date: date
    status: Literal['PAID', 'UNPAID'] = 'UNPAID'


class PaymentUpdate(Payment, Identity):
    pass


class Status(Identity):
    status: Literal['PAID', 'UNPAID']


class Filters(Schema):
    organization_id: int | None = Field(default=None, gt=0)
    status: Literal['PAID', 'UNPAID'] | None = None
    start_date: date | None = None
    end_date: date | None = None
    search: str = Field(default='', max_length=500)
    page: int = Field(default=1, ge=1, le=1000000)
    page_size: int = Field(default=20, ge=1, le=100)

    @model_validator(mode='after')
    def dates(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError('Ngày bắt đầu phải trước ngày kết thúc')
        return self


class JobId(Schema):
    job_id: str = Field(min_length=1, max_length=100)


class Message(Schema):
    requestId: str = Field(min_length=1, max_length=100)
    action: str = Field(min_length=1, max_length=100)
    payload: dict = Field(default_factory=dict)
    idempotencyKey: str | None = Field(default=None, min_length=16, max_length=100)
