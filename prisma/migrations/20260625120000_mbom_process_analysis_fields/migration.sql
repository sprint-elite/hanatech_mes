-- AlterTable
ALTER TABLE `mbom_process` ADD COLUMN `base_qty` INT NULL AFTER `standard_time`,
    ADD COLUMN `remark` VARCHAR(500) NULL AFTER `capacity_per_hour`;
