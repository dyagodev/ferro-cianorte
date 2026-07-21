<?php

namespace App\Services;

use App\Models\TransferenciaEstoque;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Transferência de mercadoria entre lojas da mesma empresa. O estoque só
 * sai de verdade da origem quando a NF-e é autorizada (ver emitir()) — a
 * transferência em rascunho não mexe em estoque nenhum. O destino só entra
 * quando alguém de lá confirma o recebimento físico (ver receber()), nunca
 * automático — a mercadoria pode demorar dias em trânsito.
 */
class TransferenciaEstoqueService
{
    public function __construct(private NfeService $nfe, private EstoqueService $estoque)
    {
    }

    public function criar(array $dados, User $user): TransferenciaEstoque
    {
        if ($dados['loja_origem_id'] === $dados['loja_destino_id']) {
            throw new RuntimeException('A loja de origem e destino não podem ser a mesma.');
        }

        return DB::transaction(function () use ($dados, $user) {
            $transferencia = TransferenciaEstoque::create([
                'loja_origem_id' => $dados['loja_origem_id'],
                'loja_destino_id' => $dados['loja_destino_id'],
                'observacao' => $dados['observacao'] ?? null,
                'user_id' => $user->id,
            ]);

            foreach ($dados['itens'] as $item) {
                $transferencia->itens()->create($item);
            }

            return $transferencia;
        });
    }

    public function atualizar(TransferenciaEstoque $transferencia, array $dados): TransferenciaEstoque
    {
        if (! $transferencia->editavel()) {
            throw new RuntimeException('Só é possível editar uma transferência em rascunho.');
        }

        if (($dados['loja_origem_id'] ?? $transferencia->loja_origem_id) === ($dados['loja_destino_id'] ?? $transferencia->loja_destino_id)) {
            throw new RuntimeException('A loja de origem e destino não podem ser a mesma.');
        }

        return DB::transaction(function () use ($transferencia, $dados) {
            $transferencia->update([
                'loja_origem_id' => $dados['loja_origem_id'] ?? $transferencia->loja_origem_id,
                'loja_destino_id' => $dados['loja_destino_id'] ?? $transferencia->loja_destino_id,
                'observacao' => $dados['observacao'] ?? $transferencia->observacao,
            ]);

            if (isset($dados['itens'])) {
                $transferencia->itens()->delete();
                foreach ($dados['itens'] as $item) {
                    $transferencia->itens()->create($item);
                }
            }

            return $transferencia->fresh('itens');
        });
    }

    /**
     * Emite a NF-e de transferência — se autorizada, baixa o estoque da
     * origem AGORA (mercadoria juridicamente já saiu, ver NfeService::
     * montarTransferencia) e avança o status pra em_transito. Se rejeitada,
     * fica em rascunho — dá pra corrigir e tentar de novo, sem ter mexido
     * em estoque nenhum ainda.
     */
    public function emitir(TransferenciaEstoque $transferencia, ?User $usuario = null): TransferenciaEstoque
    {
        if (! $transferencia->podeEmitir()) {
            throw new RuntimeException('Essa transferência não pode ser emitida (precisa estar em rascunho e ter ao menos um item).');
        }

        $nota = $this->nfe->emitirTransferencia($transferencia);

        if ($nota->autorizada()) {
            DB::transaction(function () use ($transferencia, $nota, $usuario) {
                foreach ($transferencia->itens as $item) {
                    $this->estoque->ajustarDelta(
                        $item->produto,
                        $transferencia->loja_origem_id,
                        -$item->quantidade,
                        'transferencia_saida',
                        usuario: $usuario,
                        origemTipo: 'transferencia_estoque',
                        origemId: $transferencia->id,
                    );
                }

                $transferencia->update(['status' => 'em_transito', 'nota_fiscal_id' => $nota->id]);
            });
        } else {
            $transferencia->update(['nota_fiscal_id' => $nota->id]);

            throw new RuntimeException('NF-e rejeitada: '.$nota->mensagem_retorno);
        }

        return $transferencia->fresh(['itens', 'notaFiscal']);
    }

    /**
     * Mesmo efeito de emitir() no estoque (baixa a origem, avança pra
     * em_transito), mas sem passar pela SEFAZ — pra transferência que não
     * precisa de nota fiscal (ex.: ajuste informal entre lojas vizinhas,
     * combinado fora do sistema). Sem NF-e não tem como cancelar de volta
     * automaticamente depois (ver cancelar() — só estorna quando tem
     * notaFiscal pra basear o "eraEmTransito"), então a única forma de
     * desfazer é o operador lançar uma transferência de volta.
     */
    public function confirmarSemNotaFiscal(TransferenciaEstoque $transferencia, ?User $usuario = null): TransferenciaEstoque
    {
        if (! $transferencia->podeEmitir()) {
            throw new RuntimeException('Essa transferência não pode ser confirmada (precisa estar em rascunho e ter ao menos um item).');
        }

        DB::transaction(function () use ($transferencia, $usuario) {
            foreach ($transferencia->itens as $item) {
                $this->estoque->ajustarDelta(
                    $item->produto,
                    $transferencia->loja_origem_id,
                    -$item->quantidade,
                    'transferencia_saida',
                    usuario: $usuario,
                    origemTipo: 'transferencia_estoque',
                    origemId: $transferencia->id,
                    observacao: 'Confirmada sem nota fiscal',
                );
            }

            $transferencia->update(['status' => 'em_transito']);
        });

        return $transferencia->fresh(['itens', 'notaFiscal']);
    }

    /**
     * Confirma que a mercadoria chegou de verdade na loja de destino —
     * ação explícita de quem recebe, nunca automática (a viagem pode levar
     * dias, e "emitida" não significa "já chegou").
     */
    public function receber(TransferenciaEstoque $transferencia, User $user): TransferenciaEstoque
    {
        if (! $transferencia->podeReceber()) {
            throw new RuntimeException('Só é possível confirmar recebimento de uma transferência em trânsito.');
        }

        DB::transaction(function () use ($transferencia, $user) {
            foreach ($transferencia->itens as $item) {
                $this->estoque->ajustarDelta(
                    $item->produto,
                    $transferencia->loja_destino_id,
                    $item->quantidade,
                    'transferencia_entrada',
                    usuario: $user,
                    origemTipo: 'transferencia_estoque',
                    origemId: $transferencia->id,
                );
            }

            $transferencia->update([
                'status' => 'recebida',
                'recebido_por' => $user->id,
                'recebido_em' => now(),
            ]);
        });

        return $transferencia->fresh(['itens', 'notaFiscal']);
    }

    /**
     * Cancela a transferência. Se ainda em rascunho (nunca emitida), só
     * marca cancelada — sem estoque nem NF-e envolvidos. Se já em trânsito
     * COM NF-e (autorizada, origem já baixada), cancela a NF-e na SEFAZ de
     * verdade e estorna a origem — só funciona dentro da janela de
     * cancelamento da SEFAZ (normalmente 24h). Se em trânsito SEM NF-e (ver
     * confirmarSemNotaFiscal), só estorna a origem, não tem nada pra
     * cancelar na SEFAZ.
     */
    public function cancelar(TransferenciaEstoque $transferencia, ?string $justificativa = null, ?User $usuario = null): TransferenciaEstoque
    {
        if (! $transferencia->podeCancelar()) {
            throw new RuntimeException('Essa transferência não pode mais ser cancelada.');
        }

        $eraEmTransito = $transferencia->status === 'em_transito';
        $temNotaFiscal = $eraEmTransito && $transferencia->nota_fiscal_id !== null;

        if ($temNotaFiscal) {
            if (blank($justificativa)) {
                throw new RuntimeException('Justificativa obrigatória pra cancelar uma transferência já emitida (vai cancelar a NF-e na SEFAZ).');
            }

            $this->nfe->cancelar($transferencia->notaFiscal, $justificativa);
        }

        DB::transaction(function () use ($transferencia, $eraEmTransito, $usuario) {
            if ($eraEmTransito) {
                foreach ($transferencia->itens as $item) {
                    $this->estoque->ajustarDelta(
                        $item->produto,
                        $transferencia->loja_origem_id,
                        $item->quantidade,
                        'transferencia_estorno',
                        usuario: $usuario,
                        origemTipo: 'transferencia_estoque',
                        origemId: $transferencia->id,
                    );
                }
            }

            $transferencia->update(['status' => 'cancelada']);
        });

        return $transferencia->fresh(['itens', 'notaFiscal']);
    }
}
