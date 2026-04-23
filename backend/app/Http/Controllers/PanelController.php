<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class PanelController extends Controller
{
    public function __invoke(): View
    {
        return view('panel', [
            'appName' => config('app.name', 'Axones V2'),
        ]);
    }
}
