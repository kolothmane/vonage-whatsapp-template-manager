CREATE TABLE users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'Viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wabas (
  id text PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Connected',
  country text NOT NULL,
  template_count integer NOT NULL DEFAULT 0,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE templates (
  id text PRIMARY KEY,
  waba_id text NOT NULL REFERENCES wabas(id) ON DELETE CASCADE,
  brand text NOT NULL,
  language text NOT NULL,
  whatsapp_lang text NOT NULL,
  original_name text NOT NULL,
  generated_name text NOT NULL,
  body text NOT NULL,
  category text NOT NULL,
  automation text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waba_id, generated_name)
);

CREATE TABLE template_versions (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE imports (
  id text PRIMARY KEY,
  waba_id text REFERENCES wabas(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  target text NOT NULL,
  mode text NOT NULL DEFAULT 'STRICT',
  status text NOT NULL DEFAULT 'Queued',
  total integer NOT NULL DEFAULT 0,
  submitted integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_items (
  id text PRIMARY KEY,
  import_id text NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
  template_id text REFERENCES templates(id) ON DELETE SET NULL,
  generated_name text NOT NULL,
  brand text NOT NULL,
  language text NOT NULL,
  payload jsonb NOT NULL,
  response jsonb,
  error text,
  status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE logs (
  id text PRIMARY KEY,
  import_id text,
  waba_id text REFERENCES wabas(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  brand text NOT NULL,
  language text NOT NULL,
  status text NOT NULL,
  payload jsonb,
  response jsonb,
  error text,
  message text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  old_value text,
  new_value text,
  date timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE variable_mappings (
  id text PRIMARY KEY,
  template_id text NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  placeholder text NOT NULL,
  key text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX templates_brand_language_idx ON templates(brand, language);
CREATE INDEX templates_status_idx ON templates(status);
CREATE INDEX imports_status_created_at_idx ON imports(status, created_at);
CREATE INDEX logs_timestamp_idx ON logs(timestamp);
CREATE INDEX logs_waba_id_idx ON logs(waba_id);
CREATE INDEX audit_logs_date_idx ON audit_logs(date);
CREATE INDEX variable_mappings_template_id_idx ON variable_mappings(template_id);
