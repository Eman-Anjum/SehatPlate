CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  dish TEXT NOT NULL,
  condition TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT NOT NULL,
  swaps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scans_user_id_idx ON scans (user_id);
