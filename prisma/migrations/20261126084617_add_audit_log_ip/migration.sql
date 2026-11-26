-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_AuditLog" ("action", "actor", "createdAt", "detail", "id", "target") SELECT "action", "actor", "createdAt", "detail", "id", "target" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
