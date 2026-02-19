-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
INSERT INTO "new_Store" (
    "id", "storeName", "banner",
    "surfaceAreaHall", "surfaceAreaTotal",
    "shoppingCenterOperator", "contractStartDate", "contractEndDate",
    "contractDuration", "minimumMonthlyRent", "percentageRent",
    "decemberFactor", "commonExpenses", "promotionFund",
    "notificationPeriodDays", "status", "createdAt", "updatedAt",
    "autoRenewal", "rentIncreaseType", "annualRentIncreasePercentage",
    "guaranteeType", "guaranteeAmount", "guaranteeCurrency"
) SELECT
    "id", "storeName", "banner",
    0, "surfaceArea",  -- surfaceAreaHall = 0, surfaceAreaTotal = old surfaceArea
    "shoppingCenterOperator", "contractStartDate", "contractEndDate",
    "contractDuration", "minimumMonthlyRent", "percentageRent",
    "decemberFactor", "commonExpenses", "promotionFund",
    "notificationPeriodDays", "status", "createdAt", "updatedAt",
    "autoRenewal", "rentIncreaseType", "annualRentIncreasePercentage",
    "guaranteeType", "guaranteeAmount", "guaranteeCurrency"
FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
