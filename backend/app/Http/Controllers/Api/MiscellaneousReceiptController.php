<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMiscellaneousReceiptRequest;
use App\Models\MiscellaneousReceipt;
use App\Models\MiscellaneousReceiptAttachment;
use App\Services\MiscellaneousReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MiscellaneousReceiptController extends Controller
{
    public function __construct(
        private readonly MiscellaneousReceiptService $miscellaneousReceipts,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = MiscellaneousReceipt::query()
            ->with(['material', 'user'])
            ->withCount('attachments')
            ->orderByDesc('received_at')
            ->orderByDesc('id');

        if ($request->query('material_id')) {
            $query->where('material_id', $request->query('material_id'));
        }

        if ($request->query('from')) {
            $query->where('received_at', '>=', $request->query('from'));
        }

        if ($request->query('to')) {
            $query->where('received_at', '<=', $request->query('to'));
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 100)));
    }

    public function store(StoreMiscellaneousReceiptRequest $request): JsonResponse
    {
        $data = $request->validated();
        $files = $request->file('attachments', []);
        unset($data['attachments']);

        $receipt = $this->miscellaneousReceipts->store($data, $request->user(), $files);

        return response()->json($receipt, 201);
    }

    public function show(MiscellaneousReceipt $miscellaneous_receipt): JsonResponse
    {
        $miscellaneous_receipt->load(['material', 'user', 'attachments']);

        return response()->json($miscellaneous_receipt);
    }

    public function downloadAttachment(
        MiscellaneousReceipt $miscellaneous_receipt,
        MiscellaneousReceiptAttachment $miscellaneous_receipt_attachment,
    ) {
        if ((int) $miscellaneous_receipt_attachment->miscellaneous_receipt_id !== (int) $miscellaneous_receipt->getKey()) {
            abort(404);
        }

        $disk = Storage::disk($miscellaneous_receipt_attachment->disk);

        if (! $disk->exists($miscellaneous_receipt_attachment->path)) {
            abort(404);
        }

        return $disk->download(
            $miscellaneous_receipt_attachment->path,
            $miscellaneous_receipt_attachment->original_name ?: 'adjunto',
        );
    }
}
