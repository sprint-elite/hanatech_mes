ALTER TABLE `products` ADD COLUMN `material_unit_cost` DECIMAL(14, 4) NULL AFTER `max_stock`;

CREATE TABLE `production_cost_basis` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `basis_type` VARCHAR(16) NOT NULL,
  `product_id` INT NULL,
  `material_unit_cost` DECIMAL(14, 4) NULL,
  `product_unit_cost` DECIMAL(14, 4) NULL,
  `selling_price` DECIMAL(14, 4) NULL,
  `labor_rate_per_sec` DECIMAL(14, 6) NULL,
  `fixed_rate_per_sec` DECIMAL(14, 6) NULL,
  `memo` VARCHAR(500) NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_cost_basis_product_id_key` (`product_id`),
  UNIQUE KEY `production_cost_basis_basis_type_product_id_key` (`basis_type`, `product_id`),
  CONSTRAINT `production_cost_basis_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `production_cost_basis` (`basis_type`, `product_id`, `labor_rate_per_sec`, `fixed_rate_per_sec`, `memo`)
VALUES ('GLOBAL', NULL, NULL, NULL, '전사 기본 손익 산정 요율');
