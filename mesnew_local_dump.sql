/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.5.2-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: mesnew
-- ------------------------------------------------------
-- Server version	11.5.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Current Database: `mesnew`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `mesnew` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `mesnew`;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
INSERT INTO `audit_log` VALUES
(1,'product',6,'CREATE',NULL,'{\"id\":6,\"productCode\":\"PP\",\"productName\":\"내캡\",\"itemType\":\"FG\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T09:51:59.566Z\",\"updatedAt\":\"2026-04-10T09:51:59.566Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":null,\"maxLotSize\":null},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-04-10 09:51:59.579',NULL,'::1'),
(2,'product',6,'UPDATE','{\"id\":6,\"productCode\":\"PP\",\"productName\":\"내캡\",\"itemType\":\"FG\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T09:51:59.566Z\",\"updatedAt\":\"2026-04-10T09:51:59.566Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":null,\"maxLotSize\":null},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','{\"id\":6,\"productCode\":\"PP\",\"productName\":\"내캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T09:51:59.566Z\",\"updatedAt\":\"2026-04-10T09:52:10.364Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":null,\"maxLotSize\":null},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-04-10 09:52:10.380',NULL,'::1'),
(3,'product',5,'UPDATE','{\"id\":5,\"productCode\":\"222\",\"productName\":\"캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T07:48:26.066Z\",\"updatedAt\":\"2026-04-10T07:48:26.066Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":null,\"maxLotSize\":null},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','{\"id\":5,\"productCode\":\"ABS\",\"productName\":\"외캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":500,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T07:48:26.066Z\",\"updatedAt\":\"2026-04-10T09:56:44.155Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":1,\"maxLotSize\":10},\"purchaseProfile\":{\"isPurchasable\":\"Y\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":\"box\",\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"Y\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-04-10 09:56:44.171',NULL,'::1'),
(4,'product',6,'UPDATE','{\"id\":6,\"productCode\":\"PP\",\"productName\":\"내캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T09:51:59.566Z\",\"updatedAt\":\"2026-04-10T09:52:10.364Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":null,\"maxLotSize\":null},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','{\"id\":6,\"productCode\":\"PP\",\"productName\":\"크림스킨 내캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T09:51:59.566Z\",\"updatedAt\":\"2026-04-10T09:57:59.785Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":null,\"maxLotSize\":null},\"purchaseProfile\":{\"isPurchasable\":\"N\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"N\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-04-10 09:57:59.804',NULL,'::1'),
(5,'product',5,'UPDATE','{\"id\":5,\"productCode\":\"ABS\",\"productName\":\"외캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":500,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T07:48:26.066Z\",\"updatedAt\":\"2026-04-10T09:56:44.155Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":1,\"maxLotSize\":10},\"purchaseProfile\":{\"isPurchasable\":\"Y\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":\"box\",\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"Y\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','{\"id\":5,\"productCode\":\"ABS\",\"productName\":\"크림스킨 외캡\",\"itemType\":\"RAW\",\"categoryId\":null,\"unit\":\"EA\",\"standardPackQty\":null,\"unitWeight\":null,\"unitVolume\":null,\"leadTime\":null,\"safetyStock\":500,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T07:48:26.066Z\",\"updatedAt\":\"2026-04-10T09:58:04.775Z\",\"category\":null,\"productionProfile\":{\"isProduction\":\"Y\",\"defaultWorkCenterId\":null,\"minLotSize\":1,\"maxLotSize\":10},\"purchaseProfile\":{\"isPurchasable\":\"Y\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":\"box\",\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"Y\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":null},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"storageType\":null,\"shelfLifeDays\":null,\"maxStock\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-04-10 09:58:04.789',NULL,'::1'),
(6,'product',4,'UPDATE','{\"id\":4,\"productCode\":\"7518626\",\"productName\":\"라네즈 크림스킨 170ML (22) 캡\",\"itemType\":\"WIP\",\"itemNumber\":null,\"unit\":\"EA\",\"standardPackQty\":126,\"unitWeight\":null,\"unitVolume\":null,\"safetyStock\":null,\"maxStock\":null,\"barcode\":null,\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T07:44:29.730Z\",\"updatedAt\":\"2026-04-10T07:44:29.730Z\",\"productionProfile\":{\"isProduction\":\"Y\"},\"purchaseProfile\":{\"isPurchasable\":\"Y\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"Y\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":\"3\"},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"purchaserCustomerId\":null,\"purchaserCustomer\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','{\"id\":4,\"productCode\":\"7518626\",\"productName\":\"라네즈 크림스킨 170ML (22) 캡\",\"itemType\":\"WIP\",\"itemNumber\":\"11223344\",\"unit\":\"EA\",\"standardPackQty\":126,\"unitWeight\":null,\"unitVolume\":null,\"safetyStock\":0,\"maxStock\":20000,\"barcode\":\"110001\",\"specJson\":null,\"status\":\"ACTIVE\",\"createdAt\":\"2026-04-10T07:44:29.730Z\",\"updatedAt\":\"2026-04-15T05:29:03.779Z\",\"productionProfile\":{\"isProduction\":\"Y\"},\"purchaseProfile\":{\"isPurchasable\":\"Y\",\"defaultSupplierId\":null,\"defaultSupplierRef\":null,\"purchaseUnit\":null,\"purchasePrice\":null,\"moq\":null},\"qualityProfile\":{\"inspectionRequiredYn\":\"Y\",\"inspectionType\":\"MANUAL\",\"defectToleranceRate\":\"3\"},\"inventoryProfile\":{\"lotControlYn\":\"Y\",\"purchaserCustomerId\":null,\"purchaserCustomer\":null},\"outsourcingProfile\":{\"isOutsourcing\":\"N\",\"defaultVendorId\":null,\"defaultVendorRef\":null}}','2026-04-15 05:29:03.798',NULL,'::1');
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `barcode`
--

DROP TABLE IF EXISTS `barcode`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES
(1,'C1','주식회사 TJS','CUSTOMER','Y',NULL,'010-1111-2222','test@naver.com','경기도 부천시 원미구 소사로 487',NULL,'2026-04-13 01:01:49.365'),
(2,'B1','테스트공급업체','SUPPLIER','Y',NULL,'010-3333-4444',NULL,NULL,NULL,'2026-04-15 07:55:22.555');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `defect_history`
--

DROP TABLE IF EXISTS `defect_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `defect_history`
--

LOCK TABLES `defect_history` WRITE;
/*!40000 ALTER TABLE `defect_history` DISABLE KEYS */;
INSERT INTO `defect_history` VALUES
(1,4,5,1,1,3,1,'2026-06-10 06:38:42.021',6,NULL,'2026-06-10 06:38:42.022'),
(2,7,5,1,3,2,5,'2026-06-10 08:07:48.906',7,NULL,'2026-06-10 08:07:48.908');
/*!40000 ALTER TABLE `defect_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `defect_type`
--

DROP TABLE IF EXISTS `defect_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `defect_type`
--

LOCK TABLES `defect_type` WRITE;
/*!40000 ALTER TABLE `defect_type` DISABLE KEYS */;
INSERT INTO `defect_type` VALUES
(1,'B1','체결 불량',NULL,'LOW','Y','2026-06-10 06:18:35.958',4);
/*!40000 ALTER TABLE `defect_type` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ebom`
--

DROP TABLE IF EXISTS `ebom`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ebom` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_product_id` int(11) NOT NULL,
  `child_product_id` int(11) NOT NULL,
  `qty` decimal(14,4) NOT NULL,
  `unit` varchar(191) NOT NULL,
  `loss_rate` decimal(6,3) DEFAULT NULL,
  `sequence` int(11) NOT NULL DEFAULT 0,
  `use_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `in_unit_price` decimal(14,4) DEFAULT NULL,
  `out_unit_price` decimal(14,4) DEFAULT NULL,
  `path_sequence` int(11) DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `spec` varchar(255) DEFAULT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ebom_parent_product_id_idx` (`parent_product_id`),
  KEY `ebom_child_product_id_fkey` (`child_product_id`),
  CONSTRAINT `ebom_child_product_id_fkey` FOREIGN KEY (`child_product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ebom_parent_product_id_fkey` FOREIGN KEY (`parent_product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ebom`
--

LOCK TABLES `ebom` WRITE;
/*!40000 ALTER TABLE `ebom` DISABLE KEYS */;
INSERT INTO `ebom` VALUES
(1,4,5,1.0000,'EA',NULL,1,'Y','2026-04-10 07:48:47.825',0.0000,0.0000,1,NULL,'ea','2026-04-10 07:48:47.825'),
(2,4,6,1.0000,'EA',NULL,0,'Y','2026-04-13 05:41:13.654',NULL,NULL,2,NULL,'ea','2026-04-13 05:41:13.654');
/*!40000 ALTER TABLE `ebom` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory`
--

DROP TABLE IF EXISTS `inventory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory`
--

LOCK TABLES `inventory` WRITE;
/*!40000 ALTER TABLE `inventory` DISABLE KEYS */;
INSERT INTO `inventory` VALUES
(1,6,NULL,NULL,NULL,9270,0,'AVAILABLE','2026-06-10 08:07:48.897'),
(2,5,NULL,NULL,NULL,9370,0,'AVAILABLE','2026-06-10 08:07:48.889'),
(4,4,1,NULL,NULL,0,0,'AVAILABLE','2026-06-10 06:44:19.509'),
(5,4,2,NULL,NULL,455,0,'AVAILABLE','2026-06-10 06:44:19.513'),
(6,5,NULL,NULL,1,10,0,'AVAILABLE','2026-04-15 07:50:20.977'),
(7,5,NULL,2,NULL,0,0,'AVAILABLE','2026-06-10 08:07:48.881'),
(8,4,4,NULL,NULL,49,0,'AVAILABLE','2026-06-10 06:38:42.028'),
(9,4,7,NULL,NULL,97,0,'AVAILABLE','2026-06-10 08:07:48.912');
/*!40000 ALTER TABLE `inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_snapshot`
--

DROP TABLE IF EXISTS `inventory_snapshot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `created_by` int(11) DEFAULT NULL,
  `remark` varchar(191) DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transaction`
--

LOCK TABLES `inventory_transaction` WRITE;
/*!40000 ALTER TABLE `inventory_transaction` DISABLE KEYS */;
INSERT INTO `inventory_transaction` VALUES
(5,5,NULL,NULL,NULL,'OUT',80,'LOT',1,NULL,NULL,10000,9920,'2026-04-13 05:57:05.415',NULL,NULL),
(6,6,NULL,NULL,NULL,'OUT',80,'LOT',1,NULL,NULL,10000,9920,'2026-04-13 05:57:05.421',NULL,NULL),
(7,4,1,NULL,NULL,'IN',75,'LOT',1,NULL,NULL,0,75,'2026-04-13 05:57:05.435',NULL,NULL),
(8,5,NULL,NULL,NULL,'OUT',500,'LOT',2,NULL,NULL,9920,9420,'2026-04-13 08:33:55.903',NULL,NULL),
(9,6,NULL,NULL,NULL,'OUT',500,'LOT',2,NULL,NULL,9920,9420,'2026-04-13 08:33:55.912',NULL,NULL),
(10,4,2,NULL,NULL,'IN',480,'LOT',2,NULL,NULL,75,555,'2026-04-13 08:33:55.921',NULL,NULL),
(11,5,NULL,NULL,NULL,'IN',10000,'ADJUST',5,NULL,NULL,0,10000,'2026-04-13 05:57:04.415',NULL,'초기재고 등록'),
(12,6,NULL,NULL,NULL,'IN',10000,'ADJUST',6,NULL,NULL,0,10000,'2026-04-13 05:57:04.421',NULL,'초기재고 등록'),
(13,5,NULL,NULL,1,'IN',10,'ADJUST',1,NULL,NULL,9420,9430,'2026-04-15 07:50:20.978',NULL,'수동 입고 등록'),
(14,5,NULL,2,NULL,'IN',100,'ADJUST',2,NULL,NULL,9430,9530,'2026-04-15 08:27:46.427',NULL,'긴급보충'),
(15,5,NULL,2,NULL,'OUT',50,'LOT',4,NULL,NULL,100,50,'2026-06-10 06:38:42.002',3,NULL),
(16,6,NULL,NULL,NULL,'OUT',50,'LOT',4,NULL,NULL,9420,9370,'2026-06-10 06:38:42.013',3,NULL),
(17,4,4,NULL,NULL,'IN',49,'LOT',4,NULL,NULL,555,604,'2026-06-10 06:38:42.030',3,NULL),
(18,4,1,NULL,NULL,'OUT',75,'SHIPMENT',1,NULL,NULL,604,529,'2026-06-10 06:44:19.511',NULL,'출하 11 · 주식회사 TJS'),
(19,4,2,NULL,NULL,'OUT',25,'SHIPMENT',1,NULL,NULL,529,504,'2026-06-10 06:44:19.514',NULL,'출하 11 · 주식회사 TJS'),
(20,5,NULL,2,NULL,'OUT',50,'LOT',7,NULL,NULL,50,0,'2026-06-10 08:07:48.883',2,NULL),
(21,5,NULL,NULL,NULL,'OUT',50,'LOT',7,NULL,NULL,9420,9370,'2026-06-10 08:07:48.891',2,NULL),
(22,6,NULL,NULL,NULL,'OUT',100,'LOT',7,NULL,NULL,9370,9270,'2026-06-10 08:07:48.898',2,NULL),
(23,4,7,NULL,NULL,'IN',97,'LOT',7,NULL,NULL,504,601,'2026-06-10 08:07:48.914',2,NULL);
/*!40000 ALTER TABLE `inventory_transaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `location`
--

DROP TABLE IF EXISTS `location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `location`
--

LOCK TABLES `location` WRITE;
/*!40000 ALTER TABLE `location` DISABLE KEYS */;
INSERT INTO `location` VALUES
(1,'CC','창고',NULL,'WAREHOUSE','Y','2026-04-13 01:07:47.346');
/*!40000 ALTER TABLE `location` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_history`
--

DROP TABLE IF EXISTS `lot_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lot_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `production_lot_id` int(11) NOT NULL,
  `event_type` enum('CREATE','MOVE','SPLIT','MERGE','CLOSE') NOT NULL,
  `event_desc` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `lot_history_production_lot_id_created_at_idx` (`production_lot_id`,`created_at`),
  CONSTRAINT `lot_history_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_history`
--

LOCK TABLES `lot_history` WRITE;
/*!40000 ALTER TABLE `lot_history` DISABLE KEYS */;
INSERT INTO `lot_history` VALUES
(3,1,'MOVE','마지막공정 EBOM 백플러시 자재품목 5 수량 80 (양품+불량 80×EBOM)','2026-04-13 05:57:05.417'),
(4,1,'MOVE','마지막공정 EBOM 백플러시 자재품목 6 수량 80 (양품+불량 80×EBOM)','2026-04-13 05:57:05.423'),
(5,2,'MOVE','마지막공정 EBOM 백플러시 자재품목 5 수량 500 (양품+불량 500×EBOM)','2026-04-13 08:33:55.905'),
(6,2,'MOVE','마지막공정 EBOM 백플러시 자재품목 6 수량 500 (양품+불량 500×EBOM)','2026-04-13 08:33:55.914'),
(7,4,'MOVE','품목 크림스킨 외캡 50개 출고 (백플러시)','2026-06-10 06:38:42.005'),
(8,4,'MOVE','품목 크림스킨 내캡 50개 출고 (백플러시)','2026-06-10 06:38:42.015'),
(9,7,'MOVE','품목 크림스킨 외캡 100개 출고 (백플러시)','2026-06-10 08:07:48.893'),
(10,7,'MOVE','품목 크림스킨 내캡 100개 출고 (백플러시)','2026-06-10 08:07:48.901');
/*!40000 ALTER TABLE `lot_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lot_material_usage`
--

DROP TABLE IF EXISTS `lot_material_usage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lot_material_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `production_lot_id` int(11) NOT NULL,
  `material_lot_id` int(11) DEFAULT NULL,
  `used_qty` decimal(14,4) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `material_product_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lot_material_usage_production_lot_id_idx` (`production_lot_id`),
  KEY `lot_material_usage_material_product_id_idx` (`material_product_id`),
  KEY `lot_material_usage_material_lot_id_fkey` (`material_lot_id`),
  CONSTRAINT `lot_material_usage_material_lot_id_fkey` FOREIGN KEY (`material_lot_id`) REFERENCES `material_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `lot_material_usage_material_product_id_fkey` FOREIGN KEY (`material_product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `lot_material_usage_production_lot_id_fkey` FOREIGN KEY (`production_lot_id`) REFERENCES `production_lot` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lot_material_usage`
--

LOCK TABLES `lot_material_usage` WRITE;
/*!40000 ALTER TABLE `lot_material_usage` DISABLE KEYS */;
INSERT INTO `lot_material_usage` VALUES
(1,4,2,50.0000,'2026-06-10 06:38:41.994',NULL),
(2,7,2,50.0000,'2026-06-10 08:07:48.877',NULL);
/*!40000 ALTER TABLE `lot_material_usage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material_lot`
--

DROP TABLE IF EXISTS `material_lot`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material_lot`
--

LOCK TABLES `material_lot` WRITE;
/*!40000 ALTER TABLE `material_lot` DISABLE KEYS */;
INSERT INTO `material_lot` VALUES
(2,'CC100001',5,NULL,100.0000,0.0000,'2026-04-15','USED','2026-04-15 08:27:46.420');
/*!40000 ALTER TABLE `material_lot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mbom_process`
--

DROP TABLE IF EXISTS `mbom_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mbom_process`
--

LOCK TABLES `mbom_process` WRITE;
/*!40000 ALTER TABLE `mbom_process` DISABLE KEYS */;
INSERT INTO `mbom_process` VALUES
(1,4,'0001','외캡,내캡 키잡이 위치확인',1,NULL,NULL,NULL,NULL,'N','Y','2026-04-10 09:59:26.734'),
(2,4,'0002','키잡이에 맞게 반조립',2,NULL,NULL,NULL,NULL,'N','Y','2026-04-13 01:03:32.085'),
(3,4,'0003','프레스로 압입 작업',3,NULL,NULL,NULL,NULL,'N','Y','2026-04-13 01:03:54.309'),
(4,4,'0004','로고, 나사선 시작 확인',4,NULL,NULL,NULL,NULL,'N','Y','2026-04-13 01:04:18.472'),
(5,4,'0005','먼지 제거 및 세척 포장',5,NULL,NULL,NULL,NULL,'N','Y','2026-04-13 01:04:32.816');
/*!40000 ALTER TABLE `mbom_process` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mbom_process_material`
--

DROP TABLE IF EXISTS `mbom_process_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mbom_process_material`
--

LOCK TABLES `mbom_process_material` WRITE;
/*!40000 ALTER TABLE `mbom_process_material` DISABLE KEYS */;
INSERT INTO `mbom_process_material` VALUES
(1,1,5,1.0000,'EA',NULL,'N','2026-04-13 01:07:03.180'),
(2,1,6,1.0000,'EA',NULL,'N','2026-04-13 01:07:11.749');
/*!40000 ALTER TABLE `mbom_process_material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notice`
--

DROP TABLE IF EXISTS `notice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `process_result`
--

LOCK TABLES `process_result` WRITE;
/*!40000 ALTER TABLE `process_result` DISABLE KEYS */;
INSERT INTO `process_result` VALUES
(4,1,5,5,NULL,NULL,80,75,5,NULL,NULL,'2026-04-13 05:57:05.428'),
(5,2,5,5,NULL,NULL,500,480,20,NULL,NULL,'2026-04-13 08:33:55.915'),
(6,4,5,5,3,1,50,49,1,NULL,NULL,'2026-06-10 06:38:42.016'),
(7,7,5,5,2,5,100,97,3,NULL,NULL,'2026-06-10 08:07:48.903');
/*!40000 ALTER TABLE `process_result` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `process_routing`
--

DROP TABLE IF EXISTS `process_routing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_inventory` (
  `product_id` int(11) NOT NULL,
  `lot_control_yn` enum('Y','N') NOT NULL DEFAULT 'Y',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `purchaser_customer_id` int(11) DEFAULT NULL,
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
INSERT INTO `product_inventory` VALUES
(4,'Y','2026-04-10 07:44:29.736',NULL),
(5,'Y','2026-04-10 07:48:26.076',NULL),
(6,'Y','2026-04-10 09:51:59.572',NULL);
/*!40000 ALTER TABLE `product_inventory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_outsourcing`
--

DROP TABLE IF EXISTS `product_outsourcing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_outsourcing` (
  `product_id` int(11) NOT NULL,
  `is_outsourcing` enum('Y','N') NOT NULL DEFAULT 'N',
  `default_vendor` varchar(191) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `default_vendor_id` int(11) DEFAULT NULL,
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
INSERT INTO `product_outsourcing` VALUES
(4,'N',NULL,'2026-04-10 07:44:29.738',NULL),
(5,'N',NULL,'2026-04-10 07:48:26.077',NULL),
(6,'N',NULL,'2026-04-10 09:51:59.573',NULL);
/*!40000 ALTER TABLE `product_outsourcing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_production`
--

DROP TABLE IF EXISTS `product_production`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
INSERT INTO `product_production` VALUES
(4,'Y','2026-04-10 07:44:29.732'),
(5,'Y','2026-04-10 07:48:26.069'),
(6,'Y','2026-04-10 09:51:59.568');
/*!40000 ALTER TABLE `product_production` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_purchase`
--

DROP TABLE IF EXISTS `product_purchase`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_purchase` (
  `product_id` int(11) NOT NULL,
  `is_purchasable` enum('Y','N') NOT NULL DEFAULT 'N',
  `default_supplier` varchar(191) DEFAULT NULL,
  `purchase_unit` varchar(191) DEFAULT NULL,
  `purchase_price` decimal(14,4) DEFAULT NULL,
  `moq` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `default_supplier_id` int(11) DEFAULT NULL,
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
INSERT INTO `product_purchase` VALUES
(4,'Y',NULL,NULL,NULL,NULL,'2026-04-10 07:44:29.733',NULL),
(5,'Y',NULL,'box',NULL,NULL,'2026-04-10 07:48:26.071',NULL),
(6,'N',NULL,NULL,NULL,NULL,'2026-04-10 09:51:59.569',NULL);
/*!40000 ALTER TABLE `product_purchase` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_quality`
--

DROP TABLE IF EXISTS `product_quality`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
INSERT INTO `product_quality` VALUES
(4,'Y','MANUAL',3.000,'2026-04-10 07:44:29.735'),
(5,'Y','MANUAL',NULL,'2026-04-10 07:48:26.073'),
(6,'N','MANUAL',NULL,'2026-04-10 09:51:59.571');
/*!40000 ALTER TABLE `product_quality` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_hourly`
--

DROP TABLE IF EXISTS `production_hourly`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_lot`
--

LOCK TABLES `production_lot` WRITE;
/*!40000 ALTER TABLE `production_lot` DISABLE KEYS */;
INSERT INTO `production_lot` VALUES
(1,'123456789',1,4,5000,75,5,'IN_PROGRESS',NULL,'2026-04-13 01:48:06.930',5,NULL,4),
(2,'987654321',2,4,600,480,20,'IN_PROGRESS',NULL,'2026-04-13 08:11:24.723',5,NULL,1),
(3,'111111111',3,4,800,0,0,'CREATED',NULL,'2026-04-13 08:11:39.186',NULL,NULL,0),
(4,'444444444',4,4,100,49,1,'IN_PROGRESS',1,'2026-04-13 10:02:16.870',5,NULL,1),
(5,'55555',5,4,1890,0,0,'CREATED',4,'2026-06-10 02:31:41.404',NULL,NULL,0),
(7,'6666666',6,4,126,97,3,'IN_PROGRESS',5,'2026-06-10 08:07:24.494',5,NULL,1);
/*!40000 ALTER TABLE `production_lot` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_plan`
--

DROP TABLE IF EXISTS `production_plan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `production_plan`
--

LOCK TABLES `production_plan` WRITE;
/*!40000 ALTER TABLE `production_plan` DISABLE KEYS */;
INSERT INTO `production_plan` VALUES
(3,'1',4,5000,'2026-04-22','2026-04-22','1','CONFIRMED',NULL,'2026-04-13 01:15:43.874',NULL),
(4,'2',4,4000,'2026-04-23','2026-04-23',NULL,'CONFIRMED',NULL,'2026-04-13 08:10:25.980',NULL),
(5,'1100003',4,1890,'2026-06-24','2026-06-24',NULL,'PLANNED',NULL,'2026-06-10 02:29:18.744',NULL),
(6,'7',4,126,'2026-06-18','2026-06-25',NULL,'CONFIRMED',NULL,'2026-06-10 08:06:10.040',NULL);
/*!40000 ALTER TABLE `production_plan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `production_status`
--

DROP TABLE IF EXISTS `production_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_code` varchar(191) NOT NULL,
  `product_name` varchar(191) NOT NULL,
  `item_type` varchar(191) NOT NULL,
  `unit` varchar(191) NOT NULL,
  `standard_pack_qty` int(11) DEFAULT NULL,
  `unit_weight` decimal(12,4) DEFAULT NULL,
  `unit_volume` decimal(12,4) DEFAULT NULL,
  `safety_stock` int(11) DEFAULT NULL,
  `barcode` varchar(191) DEFAULT NULL,
  `spec_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`spec_json`)),
  `status` varchar(191) NOT NULL DEFAULT 'ACTIVE',
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `item_number` varchar(64) DEFAULT NULL,
  `max_stock` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_product_code_key` (`product_code`),
  UNIQUE KEY `products_barcode_key` (`barcode`),
  KEY `products_created_by_fkey` (`created_by`),
  KEY `products_updated_by_fkey` (`updated_by`),
  CONSTRAINT `products_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `products_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES
(4,'7518626','라네즈 크림스킨 170ML (22) 캡','WIP','EA',126,NULL,NULL,0,'110001',NULL,'ACTIVE','2026-04-10 07:44:29.730','2026-04-15 05:29:03.779',NULL,NULL,'11223344',20000),
(5,'ABS','크림스킨 외캡','RAW','EA',NULL,NULL,NULL,500,NULL,NULL,'ACTIVE','2026-04-10 07:48:26.066','2026-04-10 09:58:04.775',NULL,NULL,NULL,NULL),
(6,'PP','크림스킨 내캡','RAW','EA',NULL,NULL,NULL,NULL,NULL,NULL,'ACTIVE','2026-04-10 09:51:59.566','2026-04-10 09:57:59.785',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `role_name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES
(1,'최고관리자','모든 권한 설정','2026-04-13 06:04:13.376'),
(2,'직원','데이터 입력 및 조회 권한','2026-04-13 06:04:28.766');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipment`
--

DROP TABLE IF EXISTS `shipment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment`
--

LOCK TABLES `shipment` WRITE;
/*!40000 ALTER TABLE `shipment` DISABLE KEYS */;
INSERT INTO `shipment` VALUES
(1,'11','주식회사 TJS','2026-06-10','SHIPPED','2026-06-10 06:43:46.343',NULL);
/*!40000 ALTER TABLE `shipment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shipment_detail`
--

DROP TABLE IF EXISTS `shipment_detail`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shipment_detail`
--

LOCK TABLES `shipment_detail` WRITE;
/*!40000 ALTER TABLE `shipment_detail` DISABLE KEYS */;
INSERT INTO `shipment_detail` VALUES
(1,1,4,NULL,100);
/*!40000 ALTER TABLE `shipment_detail` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_log`
--

DROP TABLE IF EXISTS `system_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'test@naver.com','김대표','[dev-plain]12341234',1,NULL,NULL,NULL,'ACTIVE',NULL,'2026-04-13 06:04:51.304');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vision_raw_log`
--

DROP TABLE IF EXISTS `vision_raw_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_center`
--

LOCK TABLES `work_center` WRITE;
/*!40000 ALTER TABLE `work_center` DISABLE KEYS */;
INSERT INTO `work_center` VALUES
(1,'L1','1번 라인','LINE',NULL,'내부',NULL,'Y','2026-04-13 01:02:21.538'),
(2,'L2','2번 라인','LINE',NULL,'내부',NULL,'Y','2026-04-15 05:39:40.302'),
(3,'L3','3번 라인','LINE',NULL,'내부',NULL,'Y','2026-04-15 05:40:55.305'),
(4,'L4','4번 라인','LINE',NULL,'내부',NULL,'Y','2026-06-10 02:29:55.283'),
(5,'L5','5번 라인','LINE',NULL,'내부',NULL,'Y','2026-06-10 08:06:49.574');
/*!40000 ALTER TABLE `work_center` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_order`
--

DROP TABLE IF EXISTS `work_order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `work_order`
--

LOCK TABLES `work_order` WRITE;
/*!40000 ALTER TABLE `work_order` DISABLE KEYS */;
INSERT INTO `work_order` VALUES
(1,'1',3,4,5000,0,NULL,NULL,1,'IN_PROGRESS','1',NULL,'2026-04-13 01:18:18.538',NULL,NULL),
(2,'2',3,4,600,0,NULL,NULL,2,'IN_PROGRESS',NULL,NULL,'2026-04-13 08:10:54.959',NULL,NULL),
(3,'3',4,4,800,0,NULL,NULL,NULL,'READY',NULL,NULL,'2026-04-13 08:11:05.714',NULL,NULL),
(4,'4',4,4,300,0,NULL,NULL,3,'IN_PROGRESS',NULL,NULL,'2026-04-13 10:02:16.845',NULL,NULL),
(5,'5',5,4,1890,0,NULL,NULL,4,'IN_PROGRESS',NULL,NULL,'2026-06-10 02:31:41.382',NULL,NULL),
(6,'12555341',6,4,126,0,NULL,NULL,5,'IN_PROGRESS',NULL,NULL,'2026-06-10 08:07:12.229',NULL,NULL);
/*!40000 ALTER TABLE `work_order` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `work_order_material`
--

DROP TABLE IF EXISTS `work_order_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
INSERT INTO `work_order_worker` VALUES
(1,1),
(2,2),
(6,2),
(4,3),
(5,4);
/*!40000 ALTER TABLE `work_order_worker` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `worker_process`
--

DROP TABLE IF EXISTS `worker_process`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = utf8 */;
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
INSERT INTO `worker_product_work_time` VALUES
(2,4,400,'2026-06-10 08:08:46.345','2026-06-10 08:08:46.345'),
(3,4,300,'2026-06-10 07:55:05.007','2026-06-10 07:55:05.007');
/*!40000 ALTER TABLE `worker_product_work_time` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `workers`
--

DROP TABLE IF EXISTS `workers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `workers`
--

LOCK TABLES `workers` WRITE;
/*!40000 ALTER TABLE `workers` DISABLE KEYS */;
INSERT INTO `workers` VALUES
(1,'A1','홍길동','생산','사원',NULL,'010-2222-3333','2026-04-01','ACTIVE','2026-04-13 01:02:47.979'),
(2,'A2','이직원',NULL,'알바',NULL,'010-5555-6666','2026-04-15','ACTIVE','2026-04-15 05:40:16.243'),
(3,'A3','고길동',NULL,'사원',NULL,'010-9999-9999','2026-04-14','ACTIVE','2026-04-15 05:40:39.830'),
(4,'A4','김직원',NULL,'알바',NULL,NULL,'2026-06-24','ACTIVE','2026-06-10 02:30:22.802');
/*!40000 ALTER TABLE `workers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'mesnew'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-06-10 18:36:16
