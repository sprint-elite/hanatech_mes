/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.5.29-MariaDB, for Linux (x86_64)
--
-- Host: localhost    Database: mesnew
-- ------------------------------------------------------
-- Server version	10.5.29-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `table_name` varchar(191) NOT NULL,
  `record_id` int(11) NOT NULL,
  `action_type` varchar(191) NOT NULL,
  `old_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_value`)),
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value`)),
  `changed_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `changed_by` int(11) DEFAULT NULL,
  `ip_address` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_log_table_name_record_id_idx` (`table_name`,`record_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES (1,'product',1,'CREATE',NULL,'{\"id\":1,\"productCode\":\"010000\",\"productName\":\"테스트\",\"itemType\":\"FG\",\"itemNumber\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"safetyStock\":null,\"maxStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-05-29T07:51:52.588Z\",\"updatedAt\":\"2026-05-29T07:51:52.588Z\",\"productionProfile\":{\"isProduction\":\"Y\"},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"purchaserCustomerId\":null,\"purchaserCustomer\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-05-29 07:51:52.610',NULL,'::ffff:127.0.0.1'),(2,'product',1,'DELETE','{\"id\":1,\"productCode\":\"010000\",\"productName\":\"테스트\",\"itemType\":\"FG\",\"itemNumber\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"safetyStock\":null,\"maxStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-05-29T07:51:52.588Z\",\"updatedAt\":\"2026-05-29T07:51:52.588Z\",\"productionProfile\":{\"isProduction\":\"Y\"},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"purchaserCustomerId\":null,\"purchaserCustomer\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}',NULL,'2026-05-29 07:51:55.130',NULL,'::ffff:127.0.0.1');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `barcode`
--

DROP TABLE IF EXISTS `barcode`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `barcode` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `barcode_value` varchar(191) NOT NULL,
  `barcode_type` enum('PRODUCT','LOT','MATERIAL_LOT','LOCATION','WO') NOT NULL,
  `ref_table` varchar(191) NOT NULL,
  `ref_id` int(11) NOT NULL,
  `is_primary` enum('Y','N') NOT NULL DEFAULT 'N',
  `status` enum('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `printed_at` datetime(3) DEFAULT NULL,
  `expired_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode_barcode_value_key` (`barcode_value`),
  KEY `barcode_ref_table_ref_id_idx` (`ref_table`,`ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `barcode`
--

LOCK TABLES `barcode` WRITE;
/*!40000 ALTER TABLE `barcode` DISABLE KEYS */;
/*!40000 ALTER TABLE `barcode` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(191) NOT NULL,
  `customer_name` varchar(191) NOT NULL,
  `type` enum('CUSTOMER','SUPPLIER','OUTSOURCING') NOT NULL,
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `contact_name` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_customer_code_key` (`customer_code`),
  KEY `customers_type_idx` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `defect_history`
--

DROP TABLE IF EXISTS `defect_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `defect_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `production_lot_id` int(11) NOT NULL,
  `process_id` int(11) NOT NULL,
  `defect_type_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `work_center_id` int(11) DEFAULT NULL,
  `detected_at` datetime(3) DEFAULT NULL,
  `process_result_id` int(11) DEFAULT NULL,
  `remark` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `defect_history_production_lot_id_process_id_created_at_idx` (`production_lot_id`,`process_id`,`created_at`),
  KEY `defect_history_process_id_fkey` (`process_id`),
  KEY `defect_history_defect_type_id_fkey` (`defect_type_id`),
  KEY `defect_history_worker_id_fkey` (`worker_id`),
  KEY `defect_history_work_center_id_fkey` (`work_center_id`),
  KEY `defect_history_process_result_id_fkey` (`process_result_id`),
  CONSTRAINT `defect_history_defect_type_id_fkey` FOREIGN KEY (`defect_type_id`) REFERENCES `defect_type` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `defect_history_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `defect_history_process_result_id_fkey` FOREIGN KEY (`process_result_id`) REFERENCES `process_result` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `defect_history_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `defect_history_work_center_id_fkey` FOREIGN KEY (`work_center_id`) REFERENCES `work_center` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `defect_history_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `defect_history`
--

LOCK TABLES `defect_history` WRITE;
/*!40000 ALTER TABLE `defect_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `defect_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `defect_type`
--

DROP TABLE IF EXISTS `defect_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `defect_type` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `defect_code` varchar(191) NOT NULL,
  `defect_name` varchar(191) NOT NULL,
  `defect_category` varchar(191) DEFAULT NULL,
  `severity` varchar(191) DEFAULT NULL,
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `product_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `defect_type_product_id_defect_code_key` (`product_id`,`defect_code`),
  KEY `defect_type_product_id_idx` (`product_id`),
  CONSTRAINT `defect_type_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `defect_type`
--

LOCK TABLES `defect_type` WRITE;
/*!40000 ALTER TABLE `defect_type` DISABLE KEYS */;
/*!40000 ALTER TABLE `defect_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ebom`
--

DROP TABLE IF EXISTS `ebom`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ebom` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_product_id` int(11) NOT NULL,
  `child_product_id` int(11) NOT NULL,
  `qty` decimal(14,4) NOT NULL,
  `unit` varchar(191) NOT NULL,
  `spec` varchar(255) DEFAULT NULL,
  `loss_rate` decimal(6,3) DEFAULT NULL,
  `sequence` int(11) NOT NULL DEFAULT 0,
  `path_sequence` int(11) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `in_unit_price` decimal(14,4) DEFAULT NULL,
  `out_unit_price` decimal(14,4) DEFAULT NULL,
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ebom_parent_product_id_idx` (`parent_product_id`),
  KEY `ebom_child_product_id_fkey` (`child_product_id`),
  CONSTRAINT `ebom_child_product_id_fkey` FOREIGN KEY (`child_product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ebom_parent_product_id_fkey` FOREIGN KEY (`parent_product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ebom`
--

LOCK TABLES `ebom` WRITE;
/*!40000 ALTER TABLE `ebom` DISABLE KEYS */;
/*!40000 ALTER TABLE `ebom` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `material_lot_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL,
  `reserved_qty` int(11) NOT NULL DEFAULT 0,
  `status` enum('AVAILABLE','HOLD','DEFECT') NOT NULL DEFAULT 'AVAILABLE',
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_product_id_lot_id_idx` (`product_id`,`lot_id`),
  KEY `inventory_product_id_material_lot_id_idx` (`product_id`,`material_lot_id`),
  KEY `inventory_lot_id_fkey` (`lot_id`),
  KEY `inventory_material_lot_id_fkey` (`material_lot_id`),
  KEY `inventory_location_id_fkey` (`location_id`),
  CONSTRAINT `inventory_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `production_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_material_lot_id_fkey` FOREIGN KEY (`material_lot_id`) REFERENCES `material_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory`
--

LOCK TABLES `inventory` WRITE;
/*!40000 ALTER TABLE `inventory` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_snapshot`
--

DROP TABLE IF EXISTS `inventory_snapshot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_snapshot` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `inventory_snapshot_date_product_id_key` (`date`,`product_id`),
  KEY `inventory_snapshot_product_id_fkey` (`product_id`),
  CONSTRAINT `inventory_snapshot_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_snapshot`
--

LOCK TABLES `inventory_snapshot` WRITE;
/*!40000 ALTER TABLE `inventory_snapshot` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_snapshot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transaction`
--

DROP TABLE IF EXISTS `inventory_transaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_transaction` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `material_lot_id` int(11) DEFAULT NULL,
  `location_id` int(11) DEFAULT NULL,
  `transaction_type` enum('IN','OUT','MOVE','ADJUST') NOT NULL,
  `qty` int(11) NOT NULL,
  `ref_type` enum('WO','LOT','SHIPMENT','OUTSOURCING','ADJUST') DEFAULT NULL,
  `ref_id` int(11) DEFAULT NULL,
  `from_location_id` int(11) DEFAULT NULL,
  `to_location_id` int(11) DEFAULT NULL,
  `before_qty` int(11) DEFAULT NULL,
  `after_qty` int(11) DEFAULT NULL,
  `remark` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inventory_transaction_product_id_lot_id_created_at_idx` (`product_id`,`lot_id`,`created_at`),
  KEY `inventory_transaction_lot_id_fkey` (`lot_id`),
  KEY `inventory_transaction_material_lot_id_fkey` (`material_lot_id`),
  KEY `inventory_transaction_location_id_fkey` (`location_id`),
  KEY `inventory_transaction_from_location_id_fkey` (`from_location_id`),
  KEY `inventory_transaction_to_location_id_fkey` (`to_location_id`),
  CONSTRAINT `inventory_transaction_from_location_id_fkey` FOREIGN KEY (`from_location_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transaction_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transaction_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `production_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transaction_material_lot_id_fkey` FOREIGN KEY (`material_lot_id`) REFERENCES `material_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transaction_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `inventory_transaction_to_location_id_fkey` FOREIGN KEY (`to_location_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transaction`
--

LOCK TABLES `inventory_transaction` WRITE;
/*!40000 ALTER TABLE `inventory_transaction` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `location`
--

DROP TABLE IF EXISTS `location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `location` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_code` varchar(191) NOT NULL,
  `location_name` varchar(191) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `location_type` varchar(191) NOT NULL,
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `location_location_code_key` (`location_code`),
  KEY `location_parent_id_fkey` (`parent_id`),
  CONSTRAINT `location_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `location`
--

LOCK TABLES `location` WRITE;
/*!40000 ALTER TABLE `location` DISABLE KEYS */;
/*!40000 ALTER TABLE `location` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_history`
--

DROP TABLE IF EXISTS `lot_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `production_lot_id` int(11) NOT NULL,
  `event_type` enum('CREATE','MOVE','SPLIT','MERGE','CLOSE') NOT NULL,
  `event_desc` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `lot_history_production_lot_id_created_at_idx` (`production_lot_id`,`created_at`),
  CONSTRAINT `lot_history_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_history`
--

LOCK TABLES `lot_history` WRITE;
/*!40000 ALTER TABLE `lot_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_material_usage`
--

DROP TABLE IF EXISTS `lot_material_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lot_material_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `production_lot_id` int(11) NOT NULL,
  `material_lot_id` int(11) DEFAULT NULL,
  `material_product_id` int(11) DEFAULT NULL,
  `used_qty` decimal(14,4) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `lot_material_usage_production_lot_id_idx` (`production_lot_id`),
  KEY `lot_material_usage_material_product_id_idx` (`material_product_id`),
  KEY `lot_material_usage_material_lot_id_fkey` (`material_lot_id`),
  CONSTRAINT `lot_material_usage_material_lot_id_fkey` FOREIGN KEY (`material_lot_id`) REFERENCES `material_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `lot_material_usage_material_product_id_fkey` FOREIGN KEY (`material_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `lot_material_usage_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_material_usage`
--

LOCK TABLES `lot_material_usage` WRITE;
/*!40000 ALTER TABLE `lot_material_usage` DISABLE KEYS */;
/*!40000 ALTER TABLE `lot_material_usage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_lot`
--

DROP TABLE IF EXISTS `material_lot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `material_lot` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_no` varchar(191) NOT NULL,
  `product_id` int(11) NOT NULL,
  `supplier` varchar(191) DEFAULT NULL,
  `received_qty` decimal(14,4) NOT NULL,
  `remain_qty` decimal(14,4) NOT NULL,
  `received_date` date NOT NULL,
  `status` enum('AVAILABLE','USED','HOLD') NOT NULL DEFAULT 'AVAILABLE',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `material_lot_lot_no_key` (`lot_no`),
  KEY `material_lot_product_id_idx` (`product_id`),
  CONSTRAINT `material_lot_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_lot`
--

LOCK TABLES `material_lot` WRITE;
/*!40000 ALTER TABLE `material_lot` DISABLE KEYS */;
/*!40000 ALTER TABLE `material_lot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mbom_process`
--

DROP TABLE IF EXISTS `mbom_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `mbom_process` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `process_code` varchar(191) NOT NULL,
  `process_name` varchar(191) NOT NULL,
  `sequence` int(11) NOT NULL,
  `work_center_id` int(11) DEFAULT NULL,
  `standard_time` int(11) DEFAULT NULL,
  `setup_time` int(11) DEFAULT NULL,
  `capacity_per_hour` int(11) DEFAULT NULL,
  `is_outsourcing` enum('Y','N') NOT NULL DEFAULT 'N',
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `mbom_process_product_id_sequence_idx` (`product_id`,`sequence`),
  KEY `mbom_process_work_center_id_fkey` (`work_center_id`),
  CONSTRAINT `mbom_process_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `mbom_process_work_center_id_fkey` FOREIGN KEY (`work_center_id`) REFERENCES `work_center` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mbom_process`
--

LOCK TABLES `mbom_process` WRITE;
/*!40000 ALTER TABLE `mbom_process` DISABLE KEYS */;
/*!40000 ALTER TABLE `mbom_process` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mbom_process_material`
--

DROP TABLE IF EXISTS `mbom_process_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `mbom_process_material` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `process_id` int(11) NOT NULL,
  `material_product_id` int(11) NOT NULL,
  `qty` decimal(14,4) NOT NULL,
  `unit` varchar(191) NOT NULL,
  `loss_rate` decimal(6,3) DEFAULT NULL,
  `is_key_material` enum('Y','N') NOT NULL DEFAULT 'N',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `mbom_process_material_process_id_idx` (`process_id`),
  KEY `mbom_process_material_material_product_id_fkey` (`material_product_id`),
  CONSTRAINT `mbom_process_material_material_product_id_fkey` FOREIGN KEY (`material_product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `mbom_process_material_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mbom_process_material`
--

LOCK TABLES `mbom_process_material` WRITE;
/*!40000 ALTER TABLE `mbom_process_material` DISABLE KEYS */;
/*!40000 ALTER TABLE `mbom_process_material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notice`
--

DROP TABLE IF EXISTS `notice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `notice` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(191) NOT NULL,
  `content` text NOT NULL,
  `notice_type` varchar(191) NOT NULL,
  `priority` varchar(191) NOT NULL DEFAULT 'NORMAL',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `is_popup` enum('Y','N') NOT NULL DEFAULT 'N',
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notice`
--

LOCK TABLES `notice` WRITE;
/*!40000 ALTER TABLE `notice` DISABLE KEYS */;
/*!40000 ALTER TABLE `notice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outsourcing`
--

DROP TABLE IF EXISTS `outsourcing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `outsourcing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `outsourcing_no` varchar(191) NOT NULL,
  `production_lot_id` int(11) NOT NULL,
  `process_id` int(11) NOT NULL,
  `vendor_name` varchar(191) NOT NULL,
  `request_qty` int(11) NOT NULL,
  `out_date` date DEFAULT NULL,
  `expected_in_date` date DEFAULT NULL,
  `status` enum('REQUEST','OUT','IN','DONE') NOT NULL DEFAULT 'REQUEST',
  `out_location_id` int(11) DEFAULT NULL,
  `in_location_id` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `outsourcing_outsourcing_no_key` (`outsourcing_no`),
  KEY `outsourcing_production_lot_id_idx` (`production_lot_id`),
  KEY `outsourcing_process_id_fkey` (`process_id`),
  KEY `outsourcing_out_location_id_fkey` (`out_location_id`),
  KEY `outsourcing_in_location_id_fkey` (`in_location_id`),
  CONSTRAINT `outsourcing_in_location_id_fkey` FOREIGN KEY (`in_location_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `outsourcing_out_location_id_fkey` FOREIGN KEY (`out_location_id`) REFERENCES `location` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `outsourcing_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `outsourcing_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outsourcing`
--

LOCK TABLES `outsourcing` WRITE;
/*!40000 ALTER TABLE `outsourcing` DISABLE KEYS */;
/*!40000 ALTER TABLE `outsourcing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outsourcing_result`
--

DROP TABLE IF EXISTS `outsourcing_result`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `outsourcing_result` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `outsourcing_id` int(11) NOT NULL,
  `good_qty` int(11) NOT NULL,
  `defect_qty` int(11) NOT NULL DEFAULT 0,
  `in_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `outsourcing_result_outsourcing_id_fkey` (`outsourcing_id`),
  CONSTRAINT `outsourcing_result_outsourcing_id_fkey` FOREIGN KEY (`outsourcing_id`) REFERENCES `outsourcing` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outsourcing_result`
--

LOCK TABLES `outsourcing_result` WRITE;
/*!40000 ALTER TABLE `outsourcing_result` DISABLE KEYS */;
/*!40000 ALTER TABLE `outsourcing_result` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `process_result`
--

DROP TABLE IF EXISTS `process_result`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `process_result` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `production_lot_id` int(11) NOT NULL,
  `process_id` int(11) NOT NULL,
  `process_sequence` int(11) NOT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `work_center_id` int(11) DEFAULT NULL,
  `input_qty` int(11) NOT NULL,
  `good_qty` int(11) NOT NULL,
  `defect_qty` int(11) NOT NULL,
  `start_time` datetime(3) DEFAULT NULL,
  `end_time` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `process_result_production_lot_id_process_id_created_at_idx` (`production_lot_id`,`process_id`,`created_at`),
  KEY `process_result_process_id_fkey` (`process_id`),
  KEY `process_result_worker_id_fkey` (`worker_id`),
  KEY `process_result_work_center_id_fkey` (`work_center_id`),
  CONSTRAINT `process_result_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `process_result_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `process_result_work_center_id_fkey` FOREIGN KEY (`work_center_id`) REFERENCES `work_center` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `process_result_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `process_result`
--

LOCK TABLES `process_result` WRITE;
/*!40000 ALTER TABLE `process_result` DISABLE KEYS */;
/*!40000 ALTER TABLE `process_result` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `process_routing`
--

DROP TABLE IF EXISTS `process_routing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `process_routing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `from_process_id` int(11) DEFAULT NULL,
  `to_process_id` int(11) DEFAULT NULL,
  `condition_type` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `process_routing_product_id_idx` (`product_id`),
  KEY `process_routing_from_process_id_fkey` (`from_process_id`),
  KEY `process_routing_to_process_id_fkey` (`to_process_id`),
  CONSTRAINT `process_routing_from_process_id_fkey` FOREIGN KEY (`from_process_id`) REFERENCES `mbom_process` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `process_routing_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `process_routing_to_process_id_fkey` FOREIGN KEY (`to_process_id`) REFERENCES `mbom_process` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `process_routing`
--

LOCK TABLES `process_routing` WRITE;
/*!40000 ALTER TABLE `process_routing` DISABLE KEYS */;
/*!40000 ALTER TABLE `process_routing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `process_status`
--

DROP TABLE IF EXISTS `process_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `process_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `process_id` int(11) NOT NULL,
  `work_center_id` int(11) NOT NULL,
  `target_qty` int(11) NOT NULL,
  `actual_qty` int(11) NOT NULL DEFAULT 0,
  `progress_rate` decimal(5,2) DEFAULT NULL,
  `status` enum('RUN','STOP','WAIT') NOT NULL DEFAULT 'WAIT',
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `process_status_process_id_work_center_id_key` (`process_id`,`work_center_id`),
  KEY `process_status_work_center_id_fkey` (`work_center_id`),
  CONSTRAINT `process_status_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `process_status_work_center_id_fkey` FOREIGN KEY (`work_center_id`) REFERENCES `work_center` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `process_status`
--

LOCK TABLES `process_status` WRITE;
/*!40000 ALTER TABLE `process_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `process_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_inventory`
--

DROP TABLE IF EXISTS `product_inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_inventory` (
  `product_id` int(11) NOT NULL,
  `lot_control_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `purchaser_customer_id` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`product_id`),
  KEY `product_inventory_purchaser_customer_id_fkey` (`purchaser_customer_id`),
  CONSTRAINT `product_inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_inventory_purchaser_customer_id_fkey` FOREIGN KEY (`purchaser_customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_inventory`
--

LOCK TABLES `product_inventory` WRITE;
/*!40000 ALTER TABLE `product_inventory` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_outsourcing`
--

DROP TABLE IF EXISTS `product_outsourcing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_outsourcing` (
  `product_id` int(11) NOT NULL,
  `is_outsourcing` enum('Y','N') NOT NULL DEFAULT 'N',
  `default_vendor` varchar(191) DEFAULT NULL,
  `default_vendor_id` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`product_id`),
  KEY `product_outsourcing_default_vendor_id_fkey` (`default_vendor_id`),
  CONSTRAINT `product_outsourcing_default_vendor_id_fkey` FOREIGN KEY (`default_vendor_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `product_outsourcing_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_outsourcing`
--

LOCK TABLES `product_outsourcing` WRITE;
/*!40000 ALTER TABLE `product_outsourcing` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_outsourcing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_production`
--

DROP TABLE IF EXISTS `product_production`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_production` (
  `product_id` int(11) NOT NULL,
  `is_production` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`product_id`),
  CONSTRAINT `product_production_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_production`
--

LOCK TABLES `product_production` WRITE;
/*!40000 ALTER TABLE `product_production` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_production` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_purchase`
--

DROP TABLE IF EXISTS `product_purchase`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_purchase` (
  `product_id` int(11) NOT NULL,
  `is_purchasable` enum('Y','N') NOT NULL DEFAULT 'N',
  `default_supplier` varchar(191) DEFAULT NULL,
  `default_supplier_id` int(11) DEFAULT NULL,
  `purchase_unit` varchar(191) DEFAULT NULL,
  `purchase_price` decimal(14,4) DEFAULT NULL,
  `moq` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`product_id`),
  KEY `product_purchase_default_supplier_id_fkey` (`default_supplier_id`),
  CONSTRAINT `product_purchase_default_supplier_id_fkey` FOREIGN KEY (`default_supplier_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `product_purchase_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_purchase`
--

LOCK TABLES `product_purchase` WRITE;
/*!40000 ALTER TABLE `product_purchase` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_purchase` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_quality`
--

DROP TABLE IF EXISTS `product_quality`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_quality` (
  `product_id` int(11) NOT NULL,
  `inspection_required_yn` enum('Y','N') NOT NULL DEFAULT 'N',
  `inspection_type` varchar(191) DEFAULT NULL,
  `defect_tolerance_rate` decimal(6,3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`product_id`),
  CONSTRAINT `product_quality_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_quality`
--

LOCK TABLES `product_quality` WRITE;
/*!40000 ALTER TABLE `product_quality` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_quality` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_hourly`
--

DROP TABLE IF EXISTS `production_hourly`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_hourly` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datetime` datetime(3) NOT NULL,
  `process_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_hourly_datetime_process_id_key` (`datetime`,`process_id`),
  KEY `production_hourly_process_id_fkey` (`process_id`),
  CONSTRAINT `production_hourly_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_hourly`
--

LOCK TABLES `production_hourly` WRITE;
/*!40000 ALTER TABLE `production_hourly` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_hourly` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_lot`
--

DROP TABLE IF EXISTS `production_lot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_lot` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_no` varchar(191) NOT NULL,
  `wo_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `lot_qty` int(11) NOT NULL,
  `good_qty` int(11) NOT NULL DEFAULT 0,
  `defect_qty` int(11) NOT NULL DEFAULT 0,
  `status` enum('CREATED','IN_PROGRESS','DONE','OUTSOURCING') NOT NULL DEFAULT 'CREATED',
  `work_center_id` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `current_process_id` int(11) DEFAULT NULL,
  `current_status` varchar(191) DEFAULT NULL,
  `version_no` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_lot_lot_no_key` (`lot_no`),
  KEY `production_lot_product_id_idx` (`product_id`),
  KEY `production_lot_wo_id_idx` (`wo_id`),
  KEY `production_lot_work_center_id_fkey` (`work_center_id`),
  CONSTRAINT `production_lot_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `production_lot_wo_id_fkey` FOREIGN KEY (`wo_id`) REFERENCES `work_order` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `production_lot_work_center_id_fkey` FOREIGN KEY (`work_center_id`) REFERENCES `work_center` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_lot`
--

LOCK TABLES `production_lot` WRITE;
/*!40000 ALTER TABLE `production_lot` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_lot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_plan`
--

DROP TABLE IF EXISTS `production_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_plan` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_no` varchar(191) NOT NULL,
  `product_id` int(11) NOT NULL,
  `plan_qty` int(11) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `priority` varchar(191) DEFAULT NULL,
  `status` enum('PLANNED','CONFIRMED','CLOSED') NOT NULL DEFAULT 'PLANNED',
  `remark` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_plan_plan_no_key` (`plan_no`),
  KEY `production_plan_product_id_fkey` (`product_id`),
  KEY `production_plan_created_by_fkey` (`created_by`),
  CONSTRAINT `production_plan_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `production_plan_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_plan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_status`
--

DROP TABLE IF EXISTS `production_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `production_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `product_id` int(11) NOT NULL,
  `target_qty` int(11) NOT NULL,
  `actual_qty` int(11) NOT NULL DEFAULT 0,
  `good_qty` int(11) NOT NULL DEFAULT 0,
  `defect_qty` int(11) NOT NULL DEFAULT 0,
  `progress_rate` decimal(5,2) DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `production_status_date_product_id_key` (`date`,`product_id`),
  KEY `production_status_product_id_fkey` (`product_id`),
  CONSTRAINT `production_status_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_status`
--

LOCK TABLES `production_status` WRITE;
/*!40000 ALTER TABLE `production_status` DISABLE KEYS */;
/*!40000 ALTER TABLE `production_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_code` varchar(191) NOT NULL,
  `product_name` varchar(191) NOT NULL,
  `item_type` varchar(191) NOT NULL,
  `item_number` varchar(64) DEFAULT NULL,
  `unit` varchar(191) NOT NULL,
  `standard_pack_qty` int(11) DEFAULT NULL,
  `unit_weight` decimal(12,4) DEFAULT NULL,
  `unit_volume` decimal(12,4) DEFAULT NULL,
  `safety_stock` int(11) DEFAULT NULL,
  `max_stock` int(11) DEFAULT NULL,
  `barcode` varchar(191) DEFAULT NULL,
  `spec_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`spec_json`)),
  `status` varchar(191) NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_product_code_key` (`product_code`),
  UNIQUE KEY `products_barcode_key` (`barcode`),
  KEY `products_created_by_fkey` (`created_by`),
  KEY `products_updated_by_fkey` (`updated_by`),
  CONSTRAINT `products_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `products_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipment`
--

DROP TABLE IF EXISTS `shipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipment` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shipment_no` varchar(191) NOT NULL,
  `customer_name` varchar(191) NOT NULL,
  `shipment_date` date DEFAULT NULL,
  `status` enum('READY','SHIPPED','CANCEL') NOT NULL DEFAULT 'READY',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `shipment_shipment_no_key` (`shipment_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment`
--

LOCK TABLES `shipment` WRITE;
/*!40000 ALTER TABLE `shipment` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipment_detail`
--

DROP TABLE IF EXISTS `shipment_detail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `shipment_detail` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `shipment_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `qty` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `shipment_detail_shipment_id_idx` (`shipment_id`),
  KEY `shipment_detail_product_id_fkey` (`product_id`),
  KEY `shipment_detail_lot_id_fkey` (`lot_id`),
  CONSTRAINT `shipment_detail_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `production_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `shipment_detail_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `shipment_detail_shipment_id_fkey` FOREIGN KEY (`shipment_id`) REFERENCES `shipment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment_detail`
--

LOCK TABLES `shipment_detail` WRITE;
/*!40000 ALTER TABLE `shipment_detail` DISABLE KEYS */;
/*!40000 ALTER TABLE `shipment_detail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_log`
--

DROP TABLE IF EXISTS `system_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `log_type` enum('SYSTEM','ERROR','WARNING','DATA') NOT NULL,
  `message` text NOT NULL,
  `ref_type` varchar(191) DEFAULT NULL,
  `ref_id` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `system_log_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_log`
--

LOCK TABLES `system_log` WRITE;
/*!40000 ALTER TABLE `system_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(191) NOT NULL,
  `user_name` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role_id` int(11) NOT NULL,
  `worker_id` int(11) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_user_id_key` (`user_id`),
  UNIQUE KEY `users_worker_id_key` (`worker_id`),
  KEY `users_role_id_fkey` (`role_id`),
  CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `users_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vision_raw_log`
--

DROP TABLE IF EXISTS `vision_raw_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `vision_raw_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_id` int(11) NOT NULL,
  `process_id` int(11) NOT NULL,
  `image_path` varchar(512) NOT NULL,
  `result_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`result_json`)),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `vision_raw_log_lot_id_process_id_idx` (`lot_id`,`process_id`),
  KEY `vision_raw_log_process_id_fkey` (`process_id`),
  CONSTRAINT `vision_raw_log_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `vision_raw_log_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vision_raw_log`
--

LOCK TABLES `vision_raw_log` WRITE;
/*!40000 ALTER TABLE `vision_raw_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `vision_raw_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_center`
--

DROP TABLE IF EXISTS `work_center`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_center` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `center_code` varchar(191) NOT NULL,
  `center_name` varchar(191) NOT NULL,
  `center_type` varchar(191) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `location` varchar(191) DEFAULT NULL,
  `capacity_per_hour` int(11) DEFAULT NULL,
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_center_center_code_key` (`center_code`),
  KEY `work_center_parent_id_fkey` (`parent_id`),
  CONSTRAINT `work_center_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `work_center` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_center`
--

LOCK TABLES `work_center` WRITE;
/*!40000 ALTER TABLE `work_center` DISABLE KEYS */;
/*!40000 ALTER TABLE `work_center` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_order`
--

DROP TABLE IF EXISTS `work_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_order` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `wo_no` varchar(191) NOT NULL,
  `plan_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `order_qty` int(11) NOT NULL,
  `completed_qty` int(11) NOT NULL DEFAULT 0,
  `start_datetime` datetime(3) DEFAULT NULL,
  `end_datetime` datetime(3) DEFAULT NULL,
  `work_center_id` int(11) DEFAULT NULL,
  `status` enum('READY','IN_PROGRESS','DONE','HOLD') NOT NULL DEFAULT 'READY',
  `priority` varchar(191) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  `hold_reason` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_order_wo_no_key` (`wo_no`),
  KEY `work_order_product_id_idx` (`product_id`),
  KEY `work_order_plan_id_fkey` (`plan_id`),
  KEY `work_order_work_center_id_fkey` (`work_center_id`),
  KEY `work_order_created_by_fkey` (`created_by`),
  CONSTRAINT `work_order_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `work_order_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `production_plan` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `work_order_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `work_order_work_center_id_fkey` FOREIGN KEY (`work_center_id`) REFERENCES `work_center` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_order`
--

LOCK TABLES `work_order` WRITE;
/*!40000 ALTER TABLE `work_order` DISABLE KEYS */;
/*!40000 ALTER TABLE `work_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_order_material`
--

DROP TABLE IF EXISTS `work_order_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_order_material` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `wo_id` int(11) NOT NULL,
  `material_product_id` int(11) NOT NULL,
  `required_qty` decimal(14,4) NOT NULL,
  `issued_qty` decimal(14,4) NOT NULL DEFAULT 0.0000,
  PRIMARY KEY (`id`),
  KEY `work_order_material_wo_id_idx` (`wo_id`),
  KEY `work_order_material_material_product_id_fkey` (`material_product_id`),
  CONSTRAINT `work_order_material_material_product_id_fkey` FOREIGN KEY (`material_product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `work_order_material_wo_id_fkey` FOREIGN KEY (`wo_id`) REFERENCES `work_order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_order_material`
--

LOCK TABLES `work_order_material` WRITE;
/*!40000 ALTER TABLE `work_order_material` DISABLE KEYS */;
/*!40000 ALTER TABLE `work_order_material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_order_worker`
--

DROP TABLE IF EXISTS `work_order_worker`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `work_order_worker` (
  `wo_id` int(11) NOT NULL,
  `worker_id` int(11) NOT NULL,
  PRIMARY KEY (`wo_id`,`worker_id`),
  KEY `work_order_worker_worker_id_idx` (`worker_id`),
  CONSTRAINT `work_order_worker_wo_id_fkey` FOREIGN KEY (`wo_id`) REFERENCES `work_order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `work_order_worker_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_order_worker`
--

LOCK TABLES `work_order_worker` WRITE;
/*!40000 ALTER TABLE `work_order_worker` DISABLE KEYS */;
/*!40000 ALTER TABLE `work_order_worker` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `worker_process`
--

DROP TABLE IF EXISTS `worker_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `worker_process` (
  `worker_id` int(11) NOT NULL,
  `process_id` int(11) NOT NULL,
  PRIMARY KEY (`worker_id`,`process_id`),
  KEY `worker_process_process_id_fkey` (`process_id`),
  CONSTRAINT `worker_process_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `worker_process_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `worker_process`
--

LOCK TABLES `worker_process` WRITE;
/*!40000 ALTER TABLE `worker_process` DISABLE KEYS */;
/*!40000 ALTER TABLE `worker_process` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `worker_product_work_time`
--

DROP TABLE IF EXISTS `worker_product_work_time`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `worker_product_work_time` (
  `worker_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `work_minutes` int(11) NOT NULL DEFAULT 0,
  `updated_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`worker_id`,`product_id`),
  KEY `worker_product_work_time_product_id_idx` (`product_id`),
  CONSTRAINT `worker_product_work_time_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `worker_product_work_time_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `worker_product_work_time`
--

LOCK TABLES `worker_product_work_time` WRITE;
/*!40000 ALTER TABLE `worker_product_work_time` DISABLE KEYS */;
/*!40000 ALTER TABLE `worker_product_work_time` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workers`
--

DROP TABLE IF EXISTS `workers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `workers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `worker_code` varchar(191) NOT NULL,
  `worker_name` varchar(191) NOT NULL,
  `team` varchar(191) DEFAULT NULL,
  `position` varchar(191) DEFAULT NULL,
  `skill_level` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `workers_worker_code_key` (`worker_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workers`
--

LOCK TABLES `workers` WRITE;
/*!40000 ALTER TABLE `workers` DISABLE KEYS */;
/*!40000 ALTER TABLE `workers` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-10  9:34:17
