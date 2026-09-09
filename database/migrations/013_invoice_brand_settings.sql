ALTER TABLE organizations
  ADD COLUMN invoice_title varchar(160) NOT NULL DEFAULT 'O''NIGHT DISTRIBUTEUR',
  ADD COLUMN invoice_subtitle varchar(200) NOT NULL DEFAULT 'Distributeur Cosmetiques & Beaute',
  ADD COLUMN invoice_phones varchar(120) NOT NULL DEFAULT '076385494 | 0661754055',
  ADD COLUMN invoice_thank_you varchar(200) NOT NULL DEFAULT 'Merci de votre confiance !',
  ADD COLUMN invoice_return_policy varchar(300) NOT NULL DEFAULT 'Les articles ne sont ni repris ni echanges sans ticket.';
