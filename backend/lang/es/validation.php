<?php

return [
    'accepted' => 'El campo :attribute debe ser aceptado.',
    'array' => 'El campo :attribute debe ser un arreglo.',
    'boolean' => 'El campo :attribute debe ser verdadero o falso.',
    'confirmed' => 'La confirmacion de :attribute no coincide.',
    'date' => 'El campo :attribute no es una fecha valida.',
    'different' => 'Los campos :attribute y :other deben ser diferentes.',
    'email' => 'El campo :attribute debe ser un correo valido.',
    'exists' => 'El valor seleccionado para :attribute no es valido.',
    'file' => 'El campo :attribute debe ser un archivo.',
    'in' => 'El valor seleccionado para :attribute no es valido.',
    'integer' => 'El campo :attribute debe ser un numero entero.',
    'max' => [
        'array' => 'El campo :attribute no debe tener mas de :max elementos.',
        'file' => 'El campo :attribute no debe ser mayor a :max kilobytes.',
        'numeric' => 'El campo :attribute no debe ser mayor a :max.',
        'string' => 'El campo :attribute no debe ser mayor a :max caracteres.',
    ],
    'mimes' => 'El campo :attribute debe ser un archivo de tipo: :values.',
    'min' => [
        'array' => 'El campo :attribute debe tener al menos :min elementos.',
        'file' => 'El campo :attribute debe ser al menos de :min kilobytes.',
        'numeric' => 'El campo :attribute debe ser al menos :min.',
        'string' => 'El campo :attribute debe tener al menos :min caracteres.',
    ],
    'not_in' => 'El valor seleccionado para :attribute no es valido.',
    'numeric' => 'El campo :attribute debe ser un numero.',
    'regex' => 'El formato de :attribute no es valido.',
    'required' => 'El campo :attribute es obligatorio.',
    'required_if' => 'El campo :attribute es obligatorio cuando :other es :value.',
    'required_with' => 'El campo :attribute es obligatorio cuando :values esta presente.',
    'same' => 'Los campos :attribute y :other deben coincidir.',
    'size' => [
        'array' => 'El campo :attribute debe contener :size elementos.',
        'file' => 'El campo :attribute debe ser de :size kilobytes.',
        'numeric' => 'El campo :attribute debe ser :size.',
        'string' => 'El campo :attribute debe tener :size caracteres.',
    ],
    'string' => 'El campo :attribute debe ser texto.',
    'unique' => 'El valor de :attribute ya esta en uso.',

    'custom' => [
        'login' => [
            'required' => 'El usuario es obligatorio.',
            'max' => 'El usuario no debe superar 64 caracteres.',
            'regex' => 'El usuario solo puede incluir letras, numeros, punto, guion y guion bajo.',
        ],
        'password' => [
            'required' => 'La contrasena es obligatoria.',
            'confirmed' => 'La confirmacion de contrasena no coincide.',
        ],
    ],

    'attributes' => [
        'login' => 'usuario',
        'username' => 'usuario',
        'email' => 'correo',
        'password' => 'contrasena',
        'password_confirmation' => 'confirmacion de contrasena',
    ],
];
