-- Create qualities table with canonical codes
CREATE TABLE IF NOT EXISTS qualities (
  code TEXT PRIMARY KEY,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create quality_colors table
CREATE TABLE IF NOT EXISTS quality_colors (
  quality_code TEXT REFERENCES qualities(code) ON DELETE CASCADE,
  color_label TEXT NOT NULL,
  color_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quality_code, color_label)
);

-- Index for unique color_code lookups
CREATE INDEX IF NOT EXISTS idx_quality_colors_code ON quality_colors(color_code) 
WHERE color_code IS NOT NULL;

-- Create quality_aliases table (for future training)
CREATE TABLE IF NOT EXISTS quality_aliases (
  quality_code TEXT REFERENCES qualities(code) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quality_code, alias)
);

-- Enable RLS
ALTER TABLE qualities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_aliases ENABLE ROW LEVEL SECURITY;

-- RLS policies for qualities
CREATE POLICY "All authenticated users can view qualities"
  ON qualities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized roles can manage qualities"
  ON qualities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'accounting', 'senior_manager')
    )
  );

-- RLS policies for quality_colors
CREATE POLICY "All authenticated users can view quality_colors"
  ON quality_colors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized roles can manage quality_colors"
  ON quality_colors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'accounting', 'senior_manager')
    )
  );

-- RLS policies for quality_aliases
CREATE POLICY "All authenticated users can view quality_aliases"
  ON quality_aliases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authorized roles can manage quality_aliases"
  ON quality_aliases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'accounting', 'senior_manager')
    )
  );

-- Seed initial data from existing inventory
INSERT INTO qualities (code, aliases) 
SELECT DISTINCT quality, ARRAY[]::TEXT[]
FROM lots
WHERE quality IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- Seed colors from existing inventory
INSERT INTO quality_colors (quality_code, color_label, color_code)
SELECT DISTINCT quality, color, NULL
FROM lots
WHERE quality IS NOT NULL AND color IS NOT NULL
ON CONFLICT DO NOTHING;

COMMENT ON TABLE qualities IS 'Canonical quality codes with optional aliases';
COMMENT ON TABLE quality_colors IS 'Colors specific to each quality with optional numeric codes';
COMMENT ON TABLE quality_aliases IS 'Training aliases for quality recognition (not shown in UI)';