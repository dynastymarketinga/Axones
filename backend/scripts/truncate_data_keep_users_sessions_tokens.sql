-- Vacía datos de negocio con TRUNCATE (no elimina tablas).
-- Conserva: users, sessions, personal_access_tokens, migrations
--
-- Ejecutar en phpMyAdmin (base axones_v2) o:
--   mysql -u ... -p axones_v2 < scripts/truncate_data_keep_users_sessions_tokens.sql

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE area_requests;
TRUNCATE TABLE bobinas;
TRUNCATE TABLE cache;
TRUNCATE TABLE cache_locks;
TRUNCATE TABLE clients;
TRUNCATE TABLE client_orders;
TRUNCATE TABLE client_order_lines;
TRUNCATE TABLE corte_bobina_usages;
TRUNCATE TABLE corte_time_segments;
TRUNCATE TABLE delivery_notes;
TRUNCATE TABLE delivery_note_lines;
TRUNCATE TABLE failed_jobs;
TRUNCATE TABLE gate_movements;
TRUNCATE TABLE inventory_movements;
TRUNCATE TABLE inventory_returns;
TRUNCATE TABLE jobs;
TRUNCATE TABLE job_batches;
TRUNCATE TABLE laminacion_bobina_usages;
TRUNCATE TABLE laminacion_time_segments;
TRUNCATE TABLE materials;
TRUNCATE TABLE material_product;
TRUNCATE TABLE material_requests;
TRUNCATE TABLE material_request_lines;
TRUNCATE TABLE miscellaneous_receipts;
TRUNCATE TABLE miscellaneous_receipt_attachments;
TRUNCATE TABLE montaje_material_usages;
TRUNCATE TABLE montaje_time_segments;
TRUNCATE TABLE operational_alerts;
TRUNCATE TABLE password_reset_requests;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE printing_bobina_usages;
TRUNCATE TABLE printing_chemical_usages;
TRUNCATE TABLE printing_ink_control_lines;
TRUNCATE TABLE printing_time_segments;
TRUNCATE TABLE products;
TRUNCATE TABLE product_ink_material;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE purchase_order_lines;
TRUNCATE TABLE purchase_receipts;
TRUNCATE TABLE purchase_receipt_lines;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE tinta_mixtures;
TRUNCATE TABLE tinta_mixture_components;
TRUNCATE TABLE tinta_subareas;
TRUNCATE TABLE vendors;
TRUNCATE TABLE work_orders;
TRUNCATE TABLE work_order_corte_summaries;
TRUNCATE TABLE work_order_laminacion_summaries;
TRUNCATE TABLE work_order_lines;
TRUNCATE TABLE work_order_montaje_summaries;
TRUNCATE TABLE work_order_printing_summaries;
TRUNCATE TABLE work_order_production_items;
TRUNCATE TABLE work_order_quality_records;
TRUNCATE TABLE work_order_technical_documents;

SET FOREIGN_KEY_CHECKS = 1;

-- NO truncar: users, sessions, personal_access_tokens, migrations
