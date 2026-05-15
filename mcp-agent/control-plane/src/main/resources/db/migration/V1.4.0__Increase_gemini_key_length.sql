-- Increase the length of gemini_key_enc to support large encrypted payloads
ALTER TABLE users ALTER COLUMN gemini_key_enc TYPE TEXT;
