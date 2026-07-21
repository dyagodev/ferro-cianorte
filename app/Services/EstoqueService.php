<?php

namespace App\Services;

use App\Models\MovimentacaoEstoque;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Ponto único de escrita em produto_estoques.quantidade — qualquer lugar do
 * sistema que precisa mexer em estoque passa por aqui, pra garantir que
 * todo movimento (venda, cancelamento, transferência, sync do Link Pro,
 * ajuste manual) fica registrado em movimentacoes_estoque. Sem isso
 * centralizado, um ponto novo que mexesse direto em ProdutoEstoque::
 * increment() ficaria de fora do histórico sem ninguém perceber.
 */
class EstoqueService
{
    /**
     * Aplica uma variação (+ ou -) em cima do valor atual — usado quando o
     * que se sabe é "quanto mudou" (venda, transferência, delta do Link
     * Pro), não o valor final.
     */
    public function ajustarDelta(
        Produto $produto,
        int $lojaId,
        float $delta,
        string $tipo,
        ?User $usuario = null,
        ?string $origemTipo = null,
        ?int $origemId = null,
        ?string $observacao = null,
    ): ProdutoEstoque {
        return DB::transaction(function () use ($produto, $lojaId, $delta, $tipo, $usuario, $origemTipo, $origemId, $observacao) {
            $estoque = ProdutoEstoque::where('produto_id', $produto->id)
                ->where('loja_id', $lojaId)
                ->lockForUpdate()
                ->first();

            if (! $estoque) {
                $estoque = ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaId, 'quantidade' => 0]);
            }

            $antes = (float) $estoque->quantidade;
            $depois = $antes + $delta;

            // Pode ficar negativo de propósito (divergência não pode travar
            // caixa/transferência) — quantidade fracionária de propósito
            // (produto vendido por peso/metro).
            $estoque->update(['quantidade' => $depois]);

            $this->registrarMovimento($produto, $lojaId, $antes, $depois, $tipo, $usuario, $origemTipo, $origemId, $observacao);

            return $estoque;
        });
    }

    /**
     * Define o valor final direto — usado quando o que se sabe é "o valor
     * correto agora" (correção manual do admin, reconciliação completa do
     * Link Pro), não uma variação.
     */
    public function definirAbsoluto(
        Produto $produto,
        int $lojaId,
        float $quantidade,
        string $tipo,
        ?User $usuario = null,
        ?string $origemTipo = null,
        ?int $origemId = null,
        ?string $observacao = null,
    ): ProdutoEstoque {
        return DB::transaction(function () use ($produto, $lojaId, $quantidade, $tipo, $usuario, $origemTipo, $origemId, $observacao) {
            $estoque = ProdutoEstoque::where('produto_id', $produto->id)
                ->where('loja_id', $lojaId)
                ->lockForUpdate()
                ->first();

            $antes = (float) ($estoque?->quantidade ?? 0);

            if ($antes === $quantidade) {
                return $estoque ?? ProdutoEstoque::create(['produto_id' => $produto->id, 'loja_id' => $lojaId, 'quantidade' => $quantidade]);
            }

            $estoque = ProdutoEstoque::updateOrCreate(
                ['produto_id' => $produto->id, 'loja_id' => $lojaId],
                ['quantidade' => $quantidade],
            );

            $this->registrarMovimento($produto, $lojaId, $antes, $quantidade, $tipo, $usuario, $origemTipo, $origemId, $observacao);

            return $estoque;
        });
    }

    private function registrarMovimento(
        Produto $produto,
        int $lojaId,
        float $antes,
        float $depois,
        string $tipo,
        ?User $usuario,
        ?string $origemTipo,
        ?int $origemId,
        ?string $observacao,
    ): void {
        MovimentacaoEstoque::create([
            'produto_id' => $produto->id,
            'loja_id' => $lojaId,
            'quantidade_antes' => $antes,
            'quantidade_depois' => $depois,
            'tipo' => $tipo,
            'origem_tipo' => $origemTipo,
            'origem_id' => $origemId,
            'user_id' => $usuario?->id,
            'observacao' => $observacao,
        ]);
    }
}
