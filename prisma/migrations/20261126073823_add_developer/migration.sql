-- AlterTable
ALTER TABLE "Release" ADD COLUMN "uploadedBy" TEXT;

-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_App" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "iconPath" TEXT,
    "screenshots" TEXT NOT NULL DEFAULT '[]',
    "webUrl" TEXT,
    "packageName" TEXT,
    "developerId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "App_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_App" ("category", "createdAt", "description", "downloadCount", "iconPath", "id", "name", "packageName", "pinned", "screenshots", "slug", "summary", "tags", "type", "updatedAt", "visibility", "webUrl") SELECT "category", "createdAt", "description", "downloadCount", "iconPath", "id", "name", "packageName", "pinned", "screenshots", "slug", "summary", "tags", "type", "updatedAt", "visibility", "webUrl" FROM "App";
DROP TABLE "App";
ALTER TABLE "new_App" RENAME TO "App";
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");
CREATE UNIQUE INDEX "App_packageName_key" ON "App"("packageName");
CREATE INDEX "App_type_visibility_idx" ON "App"("type", "visibility");
CREATE INDEX "App_category_idx" ON "App"("category");
CREATE INDEX "App_developerId_idx" ON "App"("developerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Developer_username_key" ON "Developer"("username");

-- CreateIndex
CREATE INDEX "Developer_status_idx" ON "Developer"("status");
