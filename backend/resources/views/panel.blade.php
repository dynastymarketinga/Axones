<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $appName }} — Vista previa API</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        axones: { 600: '#0f766e', 700: '#0d5c56', 50: '#f0fdfa' }
                    }
                }
            }
        }
    </script>
</head>
<body class="min-h-screen bg-slate-100 text-slate-900 antialiased">
    <header class="bg-axones-700 text-white shadow">
        <div class="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p class="text-xs uppercase tracking-wide text-teal-100">Inversiones Axones — desarrollo</p>
                <h1 class="text-xl font-semibold">{{ $appName }}</h1>
                <p class="text-sm text-teal-100/90">Vista previa: consume la API REST (mismo servidor). Para uso interno / pruebas.</p>
            </div>
            <div class="flex items-center gap-2 text-sm">
                <span id="api-status" class="rounded-full bg-white/10 px-3 py-1">API: …</span>
                <button type="button" id="btn-logout" class="hidden rounded-lg bg-white/15 px-3 py-1.5 hover:bg-white/25">Cerrar sesión API</button>
            </div>
        </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-lg font-semibold text-slate-800 mb-4">1. Acceso API (Sanctum)</h2>
            <p class="text-sm text-slate-600 mb-4">Tras <code class="rounded bg-slate-100 px-1">php artisan db:seed</code>: <strong>inventario@axones.local</strong> (rol inventario) o <strong>jefe@axones.local</strong> (rol jefe, ve todo el menú Pulse) — contraseña <strong>password</strong> en ambos de desarrollo.</p>
            <form id="login-form" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
                <div>
                    <label class="block text-xs font-medium text-slate-500 mb-1">Email</label>
                    <input type="email" name="email" value="inventario@axones.local" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autocomplete="username">
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-500 mb-1">Contraseña</label>
                    <input type="password" name="password" value="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" autocomplete="current-password">
                </div>
                <div class="sm:col-span-2 lg:col-span-2 flex gap-2">
                    <button type="submit" class="rounded-lg bg-axones-600 px-4 py-2 text-sm font-medium text-white hover:bg-axones-700">Obtener token</button>
                    <button type="button" id="btn-load-all" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50" disabled>Cargar datos</button>
                </div>
            </form>
            <p id="login-msg" class="mt-3 text-sm text-slate-600"></p>
        </section>

        <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 class="text-lg font-semibold text-slate-800 mb-4">2. Panel (KPIs — MVP §4)</h2>
            <p class="text-sm text-slate-600 mb-4">Resumen desde <code class="rounded bg-slate-100 px-1">GET /api/dashboard/summary</code>. Se rellena al pulsar «Cargar datos».</p>
            <div id="kpi-box" class="text-sm text-slate-500">Sin datos.</div>
            <div id="low-stock-box" class="mt-6"></div>
        </section>

        <div class="grid gap-8 lg:grid-cols-2">
            <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold text-slate-800 mb-3">Materiales</h2>
                <div id="materials-box" class="text-sm text-slate-500">Inicia sesión y pulsa «Cargar datos».</div>
            </section>
            <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h2 class="text-lg font-semibold text-slate-800 mb-3">Devoluciones</h2>
                <div id="returns-box" class="text-sm text-slate-500">—</div>
            </section>
            <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <h2 class="text-lg font-semibold text-slate-800 mb-3">Mezclas de tinta</h2>
                <div id="mixtures-box" class="text-sm text-slate-500">—</div>
            </section>
            <section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
                <h2 class="text-lg font-semibold text-slate-800 mb-3">Bobinas rechazadas (reporte)</h2>
                <p class="text-sm text-slate-600 mb-3"><code class="rounded bg-slate-100 px-1">GET /api/reports/rejected-bobinas-inventory</code> — stock por material del área y bobinas registradas con OT (vía devolución).</p>
                <div id="rejected-bobinas-box" class="text-sm text-slate-500">—</div>
            </section>
        </div>

        <section class="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-6">
            <h2 class="text-sm font-semibold text-slate-700 mb-2">¿Para qué es la API?</h2>
            <p class="text-sm text-slate-600 leading-relaxed">
                El <strong>backend Laravel</strong> expone JSON en <code class="rounded bg-white px-1">/api/...</code> para que luego un panel (Filament, Next/Pulse, etc.) o apps móviles consuman la misma lógica.
                Esta página solo <strong>lee</strong> datos con tu token; las altas complejas (movimientos, mezclas) siguen pudiendo probarse con Thunder Client, Postman o el test automatizado.
            </p>
            <ul class="mt-3 list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li><code class="rounded bg-white px-1">GET {{ url('/api/ping') }}</code> — sin autenticación</li>
                <li><code class="rounded bg-white px-1">GET {{ url('/api/dashboard/summary') }}</code> — KPIs (requiere token)</li>
                <li><code class="rounded bg-white px-1">GET {{ url('/api/alerts') }}</code> — alertas operativas (<code>?unread=1</code>)</li>
                <li><code class="rounded bg-white px-1">GET {{ url('/api/materials') }}</code> — requiere Bearer token</li>
            </ul>
        </section>
    </main>

    <script>
        const STORAGE_KEY = 'axones_api_token';
        const api = (path, opts = {}) => {
            const token = localStorage.getItem(STORAGE_KEY);
            const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) };
            if (token) headers['Authorization'] = 'Bearer ' + token;
            return fetch(path, { ...opts, headers });
        };

        const el = (id) => document.getElementById(id);

        async function checkPing() {
            const s = el('api-status');
            try {
                const r = await fetch('{{ url('/api/ping') }}', { headers: { 'Accept': 'application/json' } });
                const j = await r.json();
                s.textContent = r.ok && j.ok ? 'API: conectada' : 'API: error';
                s.className = 'rounded-full px-3 py-1 ' + (r.ok && j.ok ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/30 text-white');
            } catch {
                s.textContent = 'API: sin respuesta';
                s.className = 'rounded-full bg-amber-500/30 px-3 py-1 text-white';
            }
        }

        function tableHtml(rows, columns) {
            if (!rows.length) return '<p class="text-slate-500">Sin registros.</p>';
            const th = columns.map(c => `<th class="text-left font-medium text-slate-600 py-2 pr-4">${c.label}</th>`).join('');
            const tr = rows.map(row => '<tr class="border-t border-slate-100">' + columns.map(c => `<td class="py-2 pr-4">${row[c.key] ?? '—'}</td>`).join('') + '</tr>').join('');
            return `<div class="overflow-x-auto"><table class="w-full text-sm">${'<thead><tr>'+th+'</tr></thead><tbody>'+tr+'</tbody>'}</table></div>`;
        }

        async function loadMaterials() {
            const r = await api('{{ url('/api/materials') }}');
            const j = await r.json();
            if (!r.ok) {
                el('materials-box').innerHTML = '<p class="text-red-600">' + (j.message || 'Error al cargar materiales') + '</p>';
                return;
            }
            const data = j.data || j;
            const rows = (data.data || data).map(m => ({
                sku: m.sku,
                name: m.name,
                area: m.inventory_area,
                stock: m.quantity_on_hand,
                unit: m.unit || 'kg',
            }));
            el('materials-box').innerHTML = tableHtml(rows, [
                { key: 'sku', label: 'SKU' },
                { key: 'name', label: 'Nombre' },
                { key: 'area', label: 'Área' },
                { key: 'stock', label: 'Stock' },
                { key: 'unit', label: 'Ud.' },
            ]);
        }

        async function loadReturns() {
            const r = await api('{{ url('/api/inventory-returns') }}');
            const j = await r.json();
            if (!r.ok) {
                el('returns-box').innerHTML = '<p class="text-red-600">' + (j.message || 'Error') + '</p>';
                return;
            }
            const list = j.data?.data || j.data || [];
            const rows = list.map(x => ({
                id: x.id,
                status: x.status,
                qty: x.quantity,
                dest: x.destination_area,
                reason: (x.reason || '').slice(0, 40),
            }));
            el('returns-box').innerHTML = tableHtml(rows, [
                { key: 'id', label: '#' },
                { key: 'status', label: 'Estado' },
                { key: 'qty', label: 'Cant.' },
                { key: 'dest', label: 'Destino' },
                { key: 'reason', label: 'Motivo' },
            ]);
        }

        async function loadMixtures() {
            const r = await api('{{ url('/api/tinta-mixtures') }}');
            const j = await r.json();
            if (!r.ok) {
                el('mixtures-box').innerHTML = '<p class="text-red-600">' + (j.message || 'Error') + '</p>';
                return;
            }
            const list = j.data?.data || j.data || [];
            const rows = list.map(x => ({
                id: x.id,
                out: x.output_material?.sku || '—',
                name: x.output_material?.name || '—',
                comps: x.components_count ?? '—',
            }));
            el('mixtures-box').innerHTML = tableHtml(rows, [
                { key: 'id', label: '#' },
                { key: 'out', label: 'SKU salida' },
                { key: 'name', label: 'Nombre' },
                { key: 'comps', label: 'Componentes' },
            ]);
        }

        async function loadSummary() {
            const r = await api('{{ url('/api/dashboard/summary') }}');
            const j = await r.json();
            if (!r.ok) {
                el('kpi-box').innerHTML = '<p class="text-red-600">' + (j.message || 'Error en resumen') + '</p>';
                return;
            }
            const areas = j.materials_by_area || {};
            const areaLines = Object.entries(areas).map(([k, v]) => `${k}: <strong>${v}</strong>`).join(' · ') || '—';
            const alertN = j.operational_alerts_unread ?? 0;
            const alertClass = alertN > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200';
            el('kpi-box').innerHTML = `
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div class="rounded-xl bg-axones-50 border border-teal-100 px-4 py-3">
                        <p class="text-xs text-slate-500">Materiales (SKU)</p>
                        <p class="text-2xl font-semibold text-axones-700">${j.materials_total ?? 0}</p>
                    </div>
                    <div class="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                        <p class="text-xs text-slate-500">Devoluciones pendientes</p>
                        <p class="text-2xl font-semibold text-amber-800">${j.inventory_returns_pending ?? 0}</p>
                    </div>
                    <div class="rounded-xl ${alertClass} border px-4 py-3">
                        <p class="text-xs text-slate-500">Alertas sin reconocer</p>
                        <p class="text-2xl font-semibold ${alertN > 0 ? 'text-rose-700' : 'text-slate-800'}">${alertN}</p>
                    </div>
                    <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                        <p class="text-xs text-slate-500">Movimientos hoy</p>
                        <p class="text-2xl font-semibold text-slate-800">${j.movements_today ?? 0}</p>
                    </div>
                    <div class="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
                        <p class="text-xs text-slate-500">Mezclas registradas</p>
                        <p class="text-2xl font-semibold text-slate-800">${j.tinta_mixtures_total ?? 0}</p>
                    </div>
                </div>
                <p class="mt-4 text-xs text-slate-500">Por área: ${areaLines}</p>
                <p class="mt-1 text-xs text-slate-400">Generado: ${j.generated_at || '—'}</p>`;

            const lows = j.materials_low_stock || [];
            if (!lows.length) {
                el('low-stock-box').innerHTML = '<p class="text-sm text-emerald-700">Ningún material bajo mínimo (regla: stock &lt; mínimo).</p>';
                return;
            }
            const rows = lows.map(m => ({
                sku: m.sku,
                name: m.name,
                area: m.inventory_area,
                q: m.quantity_on_hand,
                min: m.min_stock,
            }));
            el('low-stock-box').innerHTML = '<p class="text-sm font-medium text-slate-700 mb-2">Stock bajo mínimo</p>' + tableHtml(rows, [
                { key: 'sku', label: 'SKU' },
                { key: 'name', label: 'Nombre' },
                { key: 'area', label: 'Área' },
                { key: 'q', label: 'Stock' },
                { key: 'min', label: 'Mín.' },
            ]);
        }

        async function loadRejectedBobinas() {
            const r = await api('{{ url('/api/reports/rejected-bobinas-inventory') }}');
            const j = await r.json();
            if (!r.ok) {
                el('rejected-bobinas-box').innerHTML = '<p class="text-red-600">' + (j.message || 'Error') + '</p>';
                return;
            }
            const mats = j.materials || [];
            const bobCount = j.bobinas_total ?? 0;
            const matRows = mats.map(m => ({
                sku: m.sku,
                name: m.name,
                stock: m.quantity_on_hand,
                unit: m.unit || 'kg',
            }));
            const matHtml = matRows.length
                ? '<p class="text-xs font-medium text-slate-600 mb-1">Materiales (área bobinas rechazadas)</p>' + tableHtml(matRows, [
                    { key: 'sku', label: 'SKU' },
                    { key: 'name', label: 'Nombre' },
                    { key: 'stock', label: 'Stock' },
                    { key: 'unit', label: 'Ud.' },
                ])
                : '<p class="text-slate-500">Sin materiales en el área bobinas rechazadas.</p>';
            const bobRows = (j.bobinas || []).slice(0, 15).map(b => ({
                code: b.code,
                kg: b.weight_kg,
                wo: b.work_order_code || '—',
                pedido: (b.client_order_reference || '—').toString().slice(0, 24),
            }));
            const bobHtml = bobRows.length
                ? '<p class="text-xs font-medium text-slate-600 mt-4 mb-1">Bobinas (máx. 15 en vista; total API: ' + bobCount + ')</p>' + tableHtml(bobRows, [
                    { key: 'code', label: 'Código bobina' },
                    { key: 'kg', label: 'Kg' },
                    { key: 'wo', label: 'OT' },
                    { key: 'pedido', label: 'Ref. pedido cliente' },
                ])
                : '<p class="text-sm text-slate-500 mt-2">Aún no hay bobinas registradas en esta área.</p>';
            el('rejected-bobinas-box').innerHTML = matHtml + bobHtml;
        }

        async function loadAll() {
            el('login-msg').textContent = 'Cargando…';
            await loadSummary();
            await Promise.all([loadMaterials(), loadReturns(), loadMixtures(), loadRejectedBobinas()]);
            el('login-msg').textContent = 'Datos actualizados.';
        }

        el('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            el('login-msg').textContent = 'Conectando…';
            const r = await fetch('{{ url('/api/auth/login') }}', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: fd.get('email'),
                    password: fd.get('password'),
                }),
            });
            const j = await r.json();
            if (!r.ok) {
                el('login-msg').textContent = j.message || 'Error de login';
                return;
            }
            localStorage.setItem(STORAGE_KEY, j.token);
            el('login-msg').textContent = 'Token guardado en este navegador.';
            el('btn-load-all').disabled = false;
            el('btn-logout').classList.remove('hidden');
        });

        el('btn-load-all').addEventListener('click', () => loadAll());
        el('btn-logout').addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY);
            el('btn-load-all').disabled = true;
            el('btn-logout').classList.add('hidden');
            el('login-msg').textContent = 'Sesión API borrada del navegador.';
            el('materials-box').textContent = 'Inicia sesión de nuevo.';
            el('returns-box').textContent = '—';
            el('mixtures-box').textContent = '—';
            el('rejected-bobinas-box').textContent = '—';
        });

        (function init() {
            checkPing();
            if (localStorage.getItem(STORAGE_KEY)) {
                el('btn-load-all').disabled = false;
                el('btn-logout').classList.remove('hidden');
                el('login-msg').textContent = 'Hay un token guardado; pulsa «Cargar datos».';
            }
        })();
    </script>
</body>
</html>
