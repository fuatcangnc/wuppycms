-- 0004_media_caption — medya meta verisine başlık (caption) sütunu.
-- Alt metin erişilebilirlik içindir; caption görselde gösterilecek bilgidir.

ALTER TABLE media_meta ADD COLUMN caption TEXT NOT NULL DEFAULT '';
