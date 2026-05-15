<?php

namespace App\Http\Requests;

use App\Enums\InventoryArea;
use App\Enums\WorkOrderPriority;
use App\Models\Material;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateWorkOrderOrdenTrabajoRequest extends FormRequest
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
            'form' => ['required', 'array'],
            'priority' => ['sometimes', 'nullable', 'string', Rule::in(WorkOrderPriority::values())],
            'assigned_areas' => ['sometimes', 'array', 'max:10'],
            'assigned_areas.*' => ['string', Rule::in(['montaje', 'impresion', 'laminacion', 'corte', 'tintas'])],
            'assignment_reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $form = $this->input('form');
            if (! is_array($form)) {
                return;
            }

            $this->validateCoreRequired($validator, $form);
            $this->validateMontaje($validator, $form);
            $this->validateImpresion($validator, $form);
            $this->validateLaminacion($validator, $form);
            $this->validateCorte($validator, $form);
        });
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function validateCoreRequired(Validator $validator, array $form): void
    {
        $pedidoKg = $this->asStringValue($form['pedidoKg'] ?? null);
        if (! $this->isDecimalLike($pedidoKg) || (float) str_replace(',', '.', $pedidoKg) <= 0) {
            $validator->errors()->add('form.pedidoKg', 'Cantidad solicitada (Kg) debe ser numérica y mayor a 0.');
        }

        if ($this->asStringValue($form['maquina'] ?? null) === '') {
            $validator->errors()->add('form.maquina', 'Maquina es obligatoria.');
        }

        $tipoImpresion = $this->asStringValue($form['tipoImpresionEstructura'] ?? null);
        if (! in_array($tipoImpresion, ['superficie', 'reverso'], true)) {
            $validator->errors()->add('form.tipoImpresionEstructura', 'Tipo impresión es obligatorio.');
        }
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function validateMontaje(Validator $validator, array $form): void
    {
        $frecuencia = $this->asStringValue($form['frecuencia'] ?? null);
        if ($frecuencia !== '' && ! $this->isMetricLike($frecuencia)) {
            $validator->errors()->add('form.frecuencia', 'Frecuencia (mm) tiene formato inválido.');
        }

        $anchoCorteMontaje = $this->asStringValue($form['anchoCorteMontaje'] ?? null);
        if ($anchoCorteMontaje !== '' && ! $this->isMetricLike($anchoCorteMontaje)) {
            $validator->errors()->add('form.anchoCorteMontaje', 'Ancho Corte (mm) tiene formato inválido.');
        }

        foreach (['numBandas', 'numRepeticion', 'numColores'] as $key) {
            $v = $this->asStringValue($form[$key] ?? null);
            if ($v !== '' && ! $this->isPositiveIntLike($v)) {
                $validator->errors()->add("form.$key", "$key debe ser entero mayor a 0.");
            }
        }
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function validateImpresion(Validator $validator, array $form): void
    {
        $pinon = $this->asStringValue($form['pinonImp'] ?? null);
        if ($pinon !== '' && ! $this->isPositiveIntLike($pinon)) {
            $validator->errors()->add('form.pinonImp', 'Piñón (dientes) debe ser entero mayor a 0.');
        }

        foreach (['kgIngresadoImp', 'kgSalidaImp', 'mermaImp', 'metrosImp'] as $key) {
            $v = $this->asStringValue($form[$key] ?? null);
            if ($v !== '' && ! $this->isDecimalLike($v)) {
                $validator->errors()->add("form.$key", "$key debe ser numérico.");
            }
        }

        $this->validateSustratosRows($validator, $form['sustratosVirgenImp'] ?? null, 'form.sustratosVirgenImp');
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function validateLaminacion(Validator $validator, array $form): void
    {
        $gramaje = $this->asStringValue($form['gramajeAdhesivo'] ?? null);
        if ($gramaje !== '' && ! $this->isDecimalLike($gramaje)) {
            $validator->errors()->add('form.gramajeAdhesivo', 'Gramaje adhesivo debe ser numérico.');
        }

        $relacion = $this->asStringValue($form['relacionMezcla'] ?? null);
        if ($relacion !== '' && ! $this->isRatioLike($relacion)) {
            $validator->errors()->add('form.relacionMezcla', 'Relación mezcla debe tener formato 100/80.');
        }

        foreach (['kgEntradaLam', 'kgSalidaLam', 'metrajeLam', 'mermaLam', 'kgEntradaLam2', 'kgSalidaLam2', 'metrajeLam2', 'mermaLam2'] as $key) {
            $v = $this->asStringValue($form[$key] ?? null);
            if ($v !== '' && ! $this->isDecimalLike($v)) {
                $validator->errors()->add("form.$key", "$key debe ser numérico.");
            }
        }

        $this->validateSustratosRows($validator, $form['sustratosVirgenLam'] ?? null, 'form.sustratosVirgenLam');
    }

    /**
     * @param  array<string, mixed>  $form
     */
    private function validateCorte(Validator $validator, array $form): void
    {
        // La planilla se guarda de forma incremental. Solo forzamos obligatorios de corte
        // cuando la OT ya está en la etapa "corte" (en otras etapas, validar solo formatos).
        $wo = $this->route('work_order');
        $stage = strtolower(trim((string) ($wo?->board_stage?->value ?? $wo?->board_stage ?? '')));
        $require = $stage === 'corte';

        foreach (['anchoCorteFinal', 'pesoBobina', 'metrosBobina', 'distFotoceldaBorde', 'distFiguraLadoContrario', 'distFiguraLadoFotocelda', 'diamBobina', 'anchoCore', 'diamCorePlg'] as $key) {
            $v = $this->asStringValue($form[$key] ?? null);
            if ($require && $v === '') {
                $validator->errors()->add("form.$key", "$key es obligatorio.");
                continue;
            }
            if ($v !== '' && ! $this->isMetricLikeOrNA($v)) {
                $validator->errors()->add("form.$key", "$key tiene formato inválido.");
            }
        }

        $orient = $this->asStringValue($form['orientacionEmbalaje'] ?? null);
        if ($require && $orient === '') {
            $validator->errors()->add('form.orientacionEmbalaje', 'Figura embobinado es obligatoria.');
        }

        $ubic = $this->asStringValue($form['ubicFotoceldaCorte'] ?? null);
        if ($require && $ubic === '') {
            $validator->errors()->add('form.ubicFotoceldaCorte', 'Ubic. fotocelda es obligatoria.');
        }

        foreach (['maxEmpates', 'cantCores'] as $key) {
            $v = $this->asStringValue($form[$key] ?? null);
            if ($require && $v === '') {
                $validator->errors()->add("form.$key", "$key es obligatorio.");
                continue;
            }
            if ($v !== '' && ! $this->isPositiveIntLike($v)) {
                $validator->errors()->add("form.$key", "$key debe ser entero mayor a 0.");
            }
        }

        foreach (['kgIngresadosCorte', 'kgSalidaCorte', 'kgMermaCorte', 'metrajeCorte'] as $key) {
            $v = $this->asStringValue($form[$key] ?? null);
            if ($require && $v === '') {
                $validator->errors()->add("form.$key", "$key es obligatorio.");
                continue;
            }
            if ($v !== '' && ! $this->isDecimalLike($v)) {
                $validator->errors()->add("form.$key", "$key debe ser numérico.");
            }
        }
    }

    private function validateSustratosRows(Validator $validator, mixed $rows, string $path): void
    {
        if ($rows === null) {
            return;
        }
        if (! is_array($rows)) {
            $validator->errors()->add($path, 'Debe ser un arreglo de sustratos.');

            return;
        }
        if (count($rows) > 4) {
            $validator->errors()->add($path, 'No puede superar 4 renglones.');

            return;
        }
        foreach ($rows as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            $kg = $this->asStringValue($row['kg'] ?? null);
            if ($kg !== '' && ! $this->isDecimalLike($kg)) {
                $validator->errors()->add("$path.$i.kg", 'Kg a utilizar debe ser numérico.');

                continue;
            }

            $this->validateSustratoRowMaterialStock($validator, $row, $i, $path, $kg);
        }
    }

    /**
     * @param  array<string, mixed>  $row
     */
    private function validateSustratoRowMaterialStock(Validator $validator, array $row, int|string $i, string $path, string $kg): void
    {
        if ($this->asStringValue($row['material_free_text'] ?? null) !== '') {
            return;
        }

        $materialIdRaw = $row['material_id'] ?? null;
        $mid = is_numeric($materialIdRaw) ? (int) $materialIdRaw : 0;
        if ($mid < 1) {
            return;
        }

        $material = Material::query()->find($mid);
        if ($material === null) {
            $validator->errors()->add("$path.$i.material_id", 'Material no encontrado.');

            return;
        }

        if ((string) $material->inventory_area !== InventoryArea::Material->value) {
            $validator->errors()->add(
                "$path.$i.material_id",
                'El material debe pertenecer al inventario de sustratos (área material).',
            );

            return;
        }

        if ($kg === '' || ! $this->isDecimalLike($kg)) {
            return;
        }

        $kgNorm = str_replace(',', '.', $kg);
        $stock = (string) $material->quantity_on_hand;
        if (bccomp($kgNorm, $stock, 3) === 1) {
            $validator->errors()->add(
                "$path.$i.kg",
                'La cantidad solicitada supera el stock disponible ('.$stock.' kg).',
            );
        }
    }

    private function asStringValue(mixed $value): string
    {
        if (is_string($value)) {
            return trim($value);
        }
        if (is_numeric($value)) {
            return (string) $value;
        }

        return '';
    }

    private function isDecimalLike(string $value): bool
    {
        $v = str_replace(',', '.', $value);

        return $v !== '' && preg_match('/^-?\d+(\.\d+)?$/', $v) === 1;
    }

    private function isRatioLike(string $value): bool
    {
        $v = preg_replace('/\s+/', '', $value) ?? '';

        return $v !== '' && preg_match('/^\d+([.,]\d+)?\/\d+([.,]\d+)?$/', $v) === 1;
    }

    private function isPositiveIntLike(string $value): bool
    {
        return preg_match('/^\d+$/', $value) === 1 && (int) $value > 0;
    }

    private function isMetricLike(string $value): bool
    {
        $n = '\d+(?:[.,]\d+)?';

        return preg_match('/^'.$n.'$/', $value) === 1
            || preg_match('/^'.$n.'\s*±\s*'.$n.'$/u', $value) === 1
            || preg_match('/^'.$n.'\s*-\s*'.$n.'$/', $value) === 1;
    }

    private function isMetricLikeOrNA(string $value): bool
    {
        if (preg_match('/^n\/a$/i', $value) === 1) {
            return true;
        }

        return $this->isMetricLike($value);
    }
}
