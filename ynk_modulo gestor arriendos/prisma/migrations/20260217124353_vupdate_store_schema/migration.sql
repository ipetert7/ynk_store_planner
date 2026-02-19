/*
  Warnings:

  - You are about to alter the column `autoRenewal` on the `Store` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Boolean`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "erpId" TEXT,
    "storeName" TEXT NOT NULL,
    "banner" TEXT NOT NULL,
    "surfaceAreaHall" REAL NOT NULL,
    "surfaceAreaTotal" REAL NOT NULL,
    "shoppingCenterOperator" TEXT NOT NULL,
    "contractStartDate" DATETIME NOT NULL,
    "contractEndDate" DATETIME NOT NULL,
    "contractDuration" INTEGER NOT NULL,
    "minimumMonthlyRent" REAL NOT NULL,
    "percentageRent" REAL NOT NULL,
    "decemberFactor" REAL NOT NULL,
    "commonExpenses" REAL NOT NULL,
    "promotionFund" REAL NOT NULL,
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
INSERT INTO "new_Store" ("annualRentIncreasePercentage", "autoRenewal", "banner", "commonExpenses", "contractDuration", "contractEndDate", "contractStartDate", "createdAt", "decemberFactor", "erpId", "guaranteeAmount", "guaranteeCurrency", "guaranteeType", "id", "minimumMonthlyRent", "notificationPeriodDays", "percentageRent", "promotionFund", "rentIncreaseType", "shoppingCenterOperator", "status", "storeName", "surfaceAreaHall", "surfaceAreaTotal", "updatedAt") SELECT "annualRentIncreasePercentage", "autoRenewal", "banner", "commonExpenses", "contractDuration", "contractEndDate", "contractStartDate", "createdAt", "decemberFactor", "erpId", "guaranteeAmount", "guaranteeCurrency", "guaranteeType", "id", "minimumMonthlyRent", "notificationPeriodDays", "percentageRent", "promotionFund", "rentIncreaseType", "shoppingCenterOperator", "status", "storeName", "surfaceAreaHall", "surfaceAreaTotal", "updatedAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE UNIQUE INDEX "Store_erpId_key" ON "Store"("erpId");
CREATE INDEX "Store_erpId_idx" ON "Store"("erpId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
