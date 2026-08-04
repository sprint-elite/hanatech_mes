ALTER TABLE `material_lot` ADD COLUMN `unit_price` DECIMAL(14, 4) NULL AFTER `received_qty`;
ALTER TABLE `inventory_transaction` ADD COLUMN `unit_price` DECIMAL(14, 4) NULL AFTER `qty`;
