-- CreateTable
CREATE TABLE "activity_report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_report_userId_date_idx" ON "activity_report"("userId", "date");

-- CreateIndex
CREATE INDEX "activity_report_date_idx" ON "activity_report"("date");

-- AddForeignKey
ALTER TABLE "activity_report" ADD CONSTRAINT "activity_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
