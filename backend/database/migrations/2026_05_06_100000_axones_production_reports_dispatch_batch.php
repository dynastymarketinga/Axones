<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('general')->after('email');
        });

        Schema::table('printing_time_segments', function (Blueprint $table) {
            $table->string('machine_code', 64)->nullable()->after('work_order_id')->index();
        });
        Schema::table('corte_time_segments', function (Blueprint $table) {
            $table->string('machine_code', 64)->nullable()->after('work_order_id')->index();
        });
        Schema::table('laminacion_time_segments', function (Blueprint $table) {
            $table->string('machine_code', 64)->nullable()->after('work_order_id')->index();
        });

        Schema::create('montaje_time_segments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->string('machine_code', 64)->nullable()->index();
            $table->string('segment_type', 24)->index();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('montaje_material_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained('work_orders')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->restrictOnDelete();
            $table->decimal('quantity', 15, 3);
            $table->string('unit', 16)->default('kg');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('work_order_montaje_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->unique()->constrained('work_orders')->cascadeOnDelete();
            $table->decimal('scrap_percent', 8, 3)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('area_requests', function (Blueprint $table) {
            $table->id();
            $table->string('area', 32)->index();
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('status', 24)->default('pending')->index();
            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('gate_movements', function (Blueprint $table) {
            $table->id();
            $table->string('direction', 8)->index();
            $table->text('notes')->nullable();
            $table->string('photo_path', 512)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('work_order_quality_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->unique()->constrained('work_orders')->cascadeOnDelete();
            $table->string('outcome', 16)->default('pending')->index();
            $table->text('notes')->nullable();
            $table->text('certificate_body')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('delivery_notes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('driver_name')->nullable();
            $table->text('vehicle_notes')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('dispatched_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('delivery_note_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_note_id')->constrained('delivery_notes')->cascadeOnDelete();
            $table->foreignId('work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('description')->nullable();
            $table->decimal('quantity_kg', 15, 3)->default(0);
            $table->string('pallet_code', 64)->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_note_lines');
        Schema::dropIfExists('delivery_notes');
        Schema::dropIfExists('work_order_quality_records');
        Schema::dropIfExists('gate_movements');
        Schema::dropIfExists('area_requests');
        Schema::dropIfExists('work_order_montaje_summaries');
        Schema::dropIfExists('montaje_material_usages');
        Schema::dropIfExists('montaje_time_segments');

        Schema::table('laminacion_time_segments', function (Blueprint $table) {
            $table->dropColumn('machine_code');
        });
        Schema::table('corte_time_segments', function (Blueprint $table) {
            $table->dropColumn('machine_code');
        });
        Schema::table('printing_time_segments', function (Blueprint $table) {
            $table->dropColumn('machine_code');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
