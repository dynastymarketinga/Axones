<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductBulkImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'dry_run' => ['nullable', 'boolean'],
            'source_filename' => ['nullable', 'string', 'max:255'],
            'clients' => ['nullable', 'array', 'max:2000'],
            'clients.*.nombre_cliente' => ['nullable', 'string', 'max:255'],
            'clients.*.rif' => ['nullable', 'string', 'max:32'],
            'clients.*.sheet_name' => ['nullable', 'string', 'max:64'],
            'clients.*.row_number' => ['nullable', 'integer', 'min:0'],
            'products' => ['required', 'array', 'min:1', 'max:5000'],
            'products.*.producto' => ['required', 'string', 'max:255'],
            'products.*.nombre_cliente' => ['nullable', 'string', 'max:255'],
            'products.*.rif_cliente' => ['nullable', 'string', 'max:32'],
            'products.*.cpe' => ['nullable', 'string', 'max:255'],
            'products.*.mps' => ['nullable', 'string', 'max:255'],
            'products.*.cod_barra' => ['nullable', 'string', 'max:255'],
            'products.*.tipo_impresion' => ['nullable', 'string', 'max:255'],
            'products.*.estructura' => ['nullable', 'string', 'max:255'],
            'products.*.sheet_name' => ['nullable', 'string', 'max:64'],
            'products.*.row_number' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
