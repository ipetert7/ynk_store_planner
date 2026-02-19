-- CreateTable
CREATE TABLE "TemporaryModification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "minimumMonthlyRent" REAL NOT NULL,
    "percentageRent" REAL NOT NULL,
    "decemberFactor" REAL NOT NULL,
    "originalMinimumMonthlyRent" REAL NOT NULL,
    "originalPercentageRent" REAL NOT NULL,
    "originalDecemberFactor" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemporaryModification_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TemporaryModification_storeId_idx" ON "TemporaryModification"("storeId");

-- CreateIndex
CREATE INDEX "TemporaryModification_startDate_idx" ON "TemporaryModification"("startDate");

-- CreateIndex
CREATE INDEX "TemporaryModification_endDate_idx" ON "TemporaryModification"("endDate");
