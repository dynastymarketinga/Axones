<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;

trait SpanishMultilineValidation
{
    protected function failedValidation(Validator $validator): void
    {
        $e = new ValidationException($validator);
        $errors = $e->errors();

        $lines = [];
        foreach ($errors as $msgs) {
            foreach ($msgs as $m) {
                $m = trim((string) $m);
                if ($m !== '') {
                    $lines[] = $m;
                }
            }
        }

        // Mensaje multilínea en español para evitar resúmenes tipo "and 1 more error" en UI.
        $message = $lines ? implode("\n", array_values(array_unique($lines))) : 'Datos inválidos.';

        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => $errors,
        ], 422));
    }
}

