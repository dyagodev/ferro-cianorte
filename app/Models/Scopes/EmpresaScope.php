<?php

namespace App\Models\Scopes;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class EmpresaScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if ($empresaId = TenantContext::id()) {
            $builder->where($model->qualifyColumn('empresa_id'), $empresaId);
        }
    }
}
