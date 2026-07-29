-- Run once on DB if prisma db push is not used:
CREATE TABLE IF NOT EXISTS `work_order_process_worker` (
  `wo_id` INT NOT NULL,
  `process_id` INT NOT NULL,
  `worker_id` INT NOT NULL,
  PRIMARY KEY (`wo_id`, `process_id`, `worker_id`),
  INDEX `work_order_process_worker_process_id_idx` (`process_id`),
  INDEX `work_order_process_worker_worker_id_idx` (`worker_id`),
  CONSTRAINT `work_order_process_worker_wo_id_fkey` FOREIGN KEY (`wo_id`) REFERENCES `work_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `work_order_process_worker_process_id_fkey` FOREIGN KEY (`process_id`) REFERENCES `mbom_process`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `work_order_process_worker_worker_id_fkey` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
