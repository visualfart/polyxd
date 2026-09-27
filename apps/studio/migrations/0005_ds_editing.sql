-- A design system can start from a template and be edited in Studio: a version says which
-- template it came from (or none), and carries a note like a screen's version does.
ALTER TABLE ds_versions ADD COLUMN notes TEXT NOT NULL DEFAULT '';
ALTER TABLE ds_versions ADD COLUMN template TEXT;
