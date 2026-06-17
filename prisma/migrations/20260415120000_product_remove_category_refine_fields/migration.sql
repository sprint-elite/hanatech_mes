-- 품목: 카테고리·리드타임·작업장/LOT제한·보관유형·유통기한 제거, 품번·최대재고(본테이블)·매입처 추가
-- categories FK 이름이 환경마다 다를 수 있어, 존재할 때만 드롭하는 패턴은 MySQL 8에서 제한적이므로
-- 표준 Prisma 명칭을 사용합니다. 실패 시 INFORMATION_SCHEMA에서 CONSTRAINT_NAME 확인 후 수정하세요.

ALTER TABLE `products` ADD COLUMN `item_number` VARCHAR(64) NULL;
ALTER TABLE `products` ADD COLUMN `max_stock` INT NULL;

UPDATE `products` p
INNER JOIN `product_inventory` pi ON pi.product_id = p.id
SET p.max_stock = pi.max_stock;

ALTER TABLE `product_inventory` ADD COLUMN `purchaser_customer_id` INT NULL;

ALTER TABLE `product_inventory`
  ADD CONSTRAINT `product_inventory_purchaser_customer_id_fkey`
  FOREIGN KEY (`purchaser_customer_id`) REFERENCES `customers` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `product_inventory` DROP COLUMN `storage_type`;
ALTER TABLE `product_inventory` DROP COLUMN `shelf_life_days`;
ALTER TABLE `product_inventory` DROP COLUMN `max_stock`;

ALTER TABLE `product_production` DROP FOREIGN KEY `product_production_default_work_center_id_fkey`;
ALTER TABLE `product_production` DROP COLUMN `default_work_center_id`;
ALTER TABLE `product_production` DROP COLUMN `min_lot_size`;
ALTER TABLE `product_production` DROP COLUMN `max_lot_size`;

ALTER TABLE `products` DROP FOREIGN KEY `products_category_id_fkey`;
ALTER TABLE `products` DROP COLUMN `category_id`;
ALTER TABLE `products` DROP COLUMN `lead_time`;

DROP TABLE IF EXISTS `categories`;
