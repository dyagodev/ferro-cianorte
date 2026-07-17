<?php

namespace App\Models\Concerns;

use App\Models\Empresa;
use App\Models\Scopes\EmpresaScope;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aplica o isolamento entre empresas (multi-tenancy) num model: toda query
 * já sai filtrada pela empresa atual (ver EmpresaScope/TenantContext) e todo
 * registro novo herda empresa_id sozinho, sem cada controller precisar
 * lembrar de setar isso à mão.
 */
trait BelongsToEmpresa
{
    protected static function bootBelongsToEmpresa(): void
    {
        static::addGlobalScope(new EmpresaScope());

        static::creating(function ($model) {
            if (! $model->empresa_id) {
                $model->empresa_id = TenantContext::id();
            }
        });
    }

    public function empresa(): BelongsTo
    {
        return $this->belongsTo(Empresa::class);
    }
}
