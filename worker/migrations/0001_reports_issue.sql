-- Reports remember the GitHub issue they were filed in (tools/reports.mjs --issues), so none is filed twice.
-- Apply to an existing database: npx wrangler d1 execute <database_name> --remote --file=migrations/0001_reports_issue.sql
ALTER TABLE reports ADD COLUMN issue INTEGER;
