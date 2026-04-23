<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('miscellaneous_receipts')) {
            Schema::create('miscellaneous_receipts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('material_id')->constrained('materials')->restrictOnDelete();
                $table->decimal('quantity', 15, 3);
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('invoice_reference')->nullable();
                $table->text('notes')->nullable();
                $table->timestamp('received_at')->useCurrent();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('miscellaneous_receipt_attachments')) {
            return;
        }

        Schema::create('miscellaneous_receipt_attachments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('miscellaneous_receipt_id');
            $table->string('disk', 24)->default('local');
            $table->string('path');
            $table->string('original_name')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->timestamps();

            $table->foreign('miscellaneous_receipt_id', 'misc_rcpt_att_rcpt_fk')
                ->references('id')
                ->on('miscellaneous_receipts')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('miscellaneous_receipt_attachments');
        Schema::dropIfExists('miscellaneous_receipts');
    }
};
