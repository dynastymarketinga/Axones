<?php

use App\Console\Commands\AxonesDemoPhaseCommand;
use App\Console\Commands\AxonesDemoReseedCommand;
use App\Console\Commands\DropDemoUsersCommand;
use App\Console\Commands\UsersGoLiveChecklistCommand;
use App\Http\Middleware\EnsureAreaRole;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withCommands([
        AxonesDemoPhaseCommand::class,
        AxonesDemoReseedCommand::class,
        DropDemoUsersCommand::class,
        UsersGoLiveChecklistCommand::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'area.role' => EnsureAreaRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('axones:consolidate-area-requests')->dailyAt('03:00');
        $schedule->command('axones:purge-done-area-requests --days=90')->dailyAt('03:15');
    })->create();
