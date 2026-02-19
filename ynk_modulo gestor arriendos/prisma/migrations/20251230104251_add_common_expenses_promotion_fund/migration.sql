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
    "commonExpenses" REAL NOT NULL DEFAULT 0,
    "promotionFund" REAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_Store" ("banner", "contractDuration", "contractEndDate", "contractStartDate", "createdAt", "decemberFactor", "id", "minimumMonthlyRent", "notificationPeriodDays", "percentageRent", "shoppingCenterOperator", "status", "storeName", "surfaceArea", "updatedAt", "autoRenewal", "rentIncreaseType", "annualRentIncreasePercentage", "guaranteeType", "guaranteeAmount", "guaranteeCurrency", "commonExpenses", "promotionFund") SELECT "banner", "contractDuration", "contractEndDate", "contractStartDate", "createdAt", "decemberFactor", "id", "minimumMonthlyRent", "notificationPeriodDays", "percentageRent", "shoppingCenterOperator", "status", "storeName", "surfaceArea", "updatedAt", "autoRenewal", "rentIncreaseType", "annualRentIncreasePercentage", "guaranteeType", "guaranteeAmount", "guaranteeCurrency", 0, 0 FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
