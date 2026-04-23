<?php

namespace App\Services;

use App\Enums\InventoryArea;
use App\Enums\InventoryMovementType;
use App\Models\Material;
use App\Models\MiscellaneousReceipt;
use App\Models\MiscellaneousReceiptAttachment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MiscellaneousReceiptService
{
    public function __construct(
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * @param  array{material_id: int, quantity: string|float, invoice_reference?: string|null, notes?: string|null, received_at?: string|null}  $data
     * @param  list<UploadedFile>  $files
     */
    public function store(array $data, User $user, array $files): MiscellaneousReceipt
    {
        if ($files === []) {
            throw ValidationException::withMessages([
                'attachments' => ['Debe adjuntar al menos un comprobante o foto.'],
            ]);
        }

        return DB::transaction(function () use ($data, $user, $files) {
            $material = Material::query()->whereKey((int) $data['material_id'])->lockForUpdate()->firstOrFail();

            if ($material->inventory_area !== InventoryArea::Miscelaneos->value) {
                throw ValidationException::withMessages([
                    'material_id' => ['La recepción de misceláneos solo aplica a materiales del área misceláneos.'],
                ]);
            }

            $qty = (string) $data['quantity'];

            $receipt = MiscellaneousReceipt::query()->create([
                'material_id' => $material->getKey(),
                'quantity' => $qty,
                'user_id' => $user->getKey(),
                'invoice_reference' => $data['invoice_reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'received_at' => isset($data['received_at']) ? new \DateTimeImmutable($data['received_at']) : now(),
            ]);

            $disk = 'local';
            $directory = 'miscellaneous_receipts/'.$receipt->getKey();

            foreach ($files as $file) {
                if (! $file instanceof UploadedFile) {
                    continue;
                }

                $storedPath = $file->store($directory, $disk);

                MiscellaneousReceiptAttachment::query()->create([
                    'miscellaneous_receipt_id' => $receipt->getKey(),
                    'disk' => $disk,
                    'path' => $storedPath,
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getClientMimeType(),
                    'size_bytes' => $file->getSize() ?: null,
                ]);
            }

            $receipt->load('attachments');

            if ($receipt->attachments->isEmpty()) {
                throw ValidationException::withMessages([
                    'attachments' => ['No se pudo guardar ningún archivo adjunto.'],
                ]);
            }

            $this->ledger->apply(
                $material,
                InventoryMovementType::In,
                $qty,
                $user,
                'miscellaneous_receipt',
                (int) $receipt->getKey(),
                [
                    'invoice_reference' => $receipt->invoice_reference,
                ],
                $receipt->received_at,
            );

            return $receipt->fresh()->load(['material', 'user', 'attachments']);
        });
    }
}
