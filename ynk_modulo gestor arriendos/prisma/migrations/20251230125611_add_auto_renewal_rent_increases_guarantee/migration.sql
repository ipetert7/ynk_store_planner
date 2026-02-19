-- CreateTable
CREATE TABLE "RentIncreaseDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "increaseDate" DATETIME NOT NULL,
    "increasePercentage" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentIncreaseDate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeName" TEXT NOT NULL,
    "banner" TEXT NOT NULL,
    "surfaceArea" REAL NOT NULL,
    "shoppingCenterOperator" TEXT NOT NULL,
    "contractStartDate" DATETIME NOT NULL,
    "contractEndDate" DATETIME NOT NULL,
    "contractDuration" INTEGER NOT NULL,
    "minimumMonthlyRent" REAL NOT NULL,
    "percentageRent" REAL NOT NULL,
    "decemberFactor" REAL NOT NULL,
    "notificationPeriodDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "rentIncreaseType" TEXT,
    "annualRentIncreasePercentage" REAL,
    "guaranteeType" TEXT,
    "guaranteeAmount" REAL,
    "guaranteeCurrency" TEXT
);
INSERT INTO "new_Store" ("banner", "contractDuration", "contractEndDate", "contractStartDate", "createdAt", "decemberFactor", "id", "minimumMonthlyRent", "notificationPeriodDays", "percentageRent", "shoppingCenterOperator", "status", "storeName", "surfaceArea", "updatedAt") SELECT "banner", "contractDuration", "contractEndDate", "contractStartDate", "createdAt", "decemberFactor", "id", "minimumMonthlyRent", "notificationPeriodDays", "percentageRent", "shoppingCenterOperator", "status", "storeName", "surfaceArea", "updatedAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RentIncreaseDate_storeId_idx" ON "RentIncreaseDate"("storeId");

-- CreateIndex
CREATE INDEX "RentIncreaseDate_increaseDate_idx" ON "RentIncreaseDate"("increaseDate");
