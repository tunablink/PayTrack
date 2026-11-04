ALTER TABLE organizations ADD COLUMN organization_type TEXT NOT NULL DEFAULT '' CHECK(length(organization_type)<=100);
ALTER TABLE organizations ADD COLUMN representative TEXT NOT NULL DEFAULT '' CHECK(length(representative)<=200);
ALTER TABLE organizations ADD COLUMN contact_email TEXT NOT NULL DEFAULT '' CHECK(length(contact_email)<=254);
ALTER TABLE organizations ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '' CHECK(length(contact_phone)<=50);
ALTER TABLE organizations ADD COLUMN address TEXT NOT NULL DEFAULT '' CHECK(length(address)<=500);
ALTER TABLE organizations ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE'));
