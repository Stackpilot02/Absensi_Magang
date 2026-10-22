-- AlterTable: username unik untuk login selain email
ALTER TABLE "users" ADD COLUMN     "username" TEXT;

-- AlterTable: jam kegiatan pada laporan kegiatan
ALTER TABLE "activity_report" ADD COLUMN     "time" TEXT NOT NULL DEFAULT '08:00';

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
