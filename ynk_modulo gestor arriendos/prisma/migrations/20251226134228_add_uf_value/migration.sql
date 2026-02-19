-- CreateTable
CREATE TABLE "UFValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UFValue_date_key" ON "UFValue"("date");

-- CreateIndex
CREATE INDEX "UFValue_date_idx" ON "UFValue"("date");
