-- lot_material_usage: 자재 LOT 없이 백플러시(무LOT 재고)도 자재 투입 화면에 남기기
ALTER TABLE `lot_material_usage` MODIFY `material_lot_id` INT NULL;
ALTER TABLE `lot_material_usage` ADD COLUMN `material_product_id` INT NULL AFTER `material_lot_id`;

ALTER TABLE `lot_material_usage`
  ADD CONSTRAINT `lot_material_usage_material_product_id_fkey`
  FOREIGN KEY (`material_product_id`) REFERENCES `products` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `lot_material_usage_material_product_id_idx` ON `lot_material_usage` (`material_product_id`);
