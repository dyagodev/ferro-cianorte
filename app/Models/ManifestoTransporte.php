<?php

namespace App\Models;

use App\Models\Concerns\BelongsToEmpresa;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'loja_id',
    'transferencia_estoque_id',
    'veiculo_tracao_id',
    'status',
    'tp_emitente',
    'numero',
    'serie',
    'codigo_numerico',
    'chave_acesso',
    'protocolo',
    'uf_ini',
    'uf_fim',
    'municipio_carregamento_codigo',
    'municipio_carregamento_nome',
    'municipio_descarga_codigo',
    'municipio_descarga_nome',
    'tipo_carga',
    'descricao_produto',
    'ncm',
    'valor_carga',
    'peso_carga_kg',
    'rntrc',
    'dh_emissao',
    'dh_inicio_viagem',
    'xml_gerado',
    'codigo_retorno',
    'mensagem_retorno',
])]
class ManifestoTransporte extends Model
{
    use BelongsToEmpresa, HasFactory;

    protected $table = 'manifestos_transporte';

    protected function casts(): array
    {
        return [
            'valor_carga' => 'decimal:2',
            'peso_carga_kg' => 'decimal:3',
            'dh_emissao' => 'datetime',
            'dh_inicio_viagem' => 'datetime',
        ];
    }

    public function loja(): BelongsTo
    {
        return $this->belongsTo(Loja::class);
    }

    public function transferenciaEstoque(): BelongsTo
    {
        return $this->belongsTo(TransferenciaEstoque::class);
    }

    public function veiculoTracao(): BelongsTo
    {
        return $this->belongsTo(Veiculo::class, 'veiculo_tracao_id');
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(ManifestoDocumento::class, 'manifesto_transporte_id');
    }

    public function condutores(): BelongsToMany
    {
        return $this->belongsToMany(Condutor::class, 'manifesto_condutores');
    }

    public function reboques(): BelongsToMany
    {
        return $this->belongsToMany(Veiculo::class, 'manifesto_reboques', 'manifesto_transporte_id', 'veiculo_id');
    }

    public function editavel(): bool
    {
        return $this->status === 'rascunho';
    }
}
