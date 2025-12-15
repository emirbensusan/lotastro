-- Phase 17: Performance indexes for count_rolls and ocr_jobs tables
-- These indexes optimize common query patterns for stock take review

-- Index for session-based queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_count_rolls_session_id ON count_rolls(session_id);

-- Index for status filtering within sessions
CREATE INDEX IF NOT EXISTS idx_count_rolls_session_status ON count_rolls(session_id, status);

-- Index for OCR confidence filtering
CREATE INDEX IF NOT EXISTS idx_count_rolls_confidence ON count_rolls(ocr_confidence_level);

-- Index for temporal ordering (capture sequence within session)
CREATE INDEX IF NOT EXISTS idx_count_rolls_session_sequence ON count_rolls(session_id, capture_sequence);

-- Index for duplicate detection queries
CREATE INDEX IF NOT EXISTS idx_count_rolls_photo_hash ON count_rolls(photo_hash_sha256);

-- Composite index for smart bulk approval filtering
CREATE INDEX IF NOT EXISTS idx_count_rolls_bulk_approval ON count_rolls(session_id, status, ocr_confidence_level, is_manual_entry, is_possible_duplicate);

-- OCR jobs queue optimization (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ocr_jobs') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status_created ON ocr_jobs(status, created_at)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ocr_jobs_roll_id ON ocr_jobs(roll_id)';
    END IF;
END $$;