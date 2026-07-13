<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\SyncConexao;
use App\Services\LinkProSyncService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
use PDO;
use PDOException;

class SyncConexaoController extends Controller
{
    public function index(): View
    {
        $conexoes = SyncConexao::with('loja')->orderBy('nome')->get();

        return view('admin.sync-conexoes.index', compact('conexoes'));
    }

    public function create(): View
    {
        $lojas = Loja::orderBy('nome')->get();

        return view('admin.sync-conexoes.form', [
            'conexao' => new SyncConexao,
            'lojas' => $lojas,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validarDados($request);

        SyncConexao::create($data);

        return redirect()->route('admin.sync-conexoes.index')->with('sucesso', 'Conexão criada com sucesso.');
    }

    public function edit(SyncConexao $syncConexao): View
    {
        $lojas = Loja::orderBy('nome')->get();

        return view('admin.sync-conexoes.form', [
            'conexao' => $syncConexao,
            'lojas' => $lojas,
        ]);
    }

    public function update(Request $request, SyncConexao $syncConexao): RedirectResponse
    {
        $data = $this->validarDados($request, atualizando: true);

        // Senha em branco na edição = manter a senha já salva (não sobrescrever com vazio).
        if (($data['senha'] ?? '') === '') {
            unset($data['senha']);
        }

        $syncConexao->update($data);

        return redirect()->route('admin.sync-conexoes.index')->with('sucesso', 'Conexão atualizada com sucesso.');
    }

    public function destroy(SyncConexao $syncConexao): RedirectResponse
    {
        $syncConexao->delete();

        return redirect()->route('admin.sync-conexoes.index')->with('sucesso', 'Conexão removida.');
    }

    /**
     * Roda a sincronização (vendas + estoque) dessa conexão agora, na hora,
     * de forma síncrona — o admin fica na tela esperando a resposta. Pensado
     * pra disparo manual; a versão agendada (cron) vai usar o mesmo service.
     */
    public function sincronizar(SyncConexao $syncConexao, LinkProSyncService $service): RedirectResponse
    {
        $execucao = $service->sincronizar($syncConexao);

        $mensagem = $execucao->status === 'sucesso'
            ? "Sincronização concluída: {$execucao->vendas_sincronizadas} venda(s), {$execucao->estoque_atualizado} produto(s) de estoque atualizado(s)."
            : "Sincronização falhou: {$execucao->erro}";

        return redirect()
            ->route('admin.sync-conexoes.index')
            ->with($execucao->status === 'sucesso' ? 'sucesso' : 'erro', $mensagem);
    }

    /**
     * Rede de segurança: lê o estoque atual inteiro direto da origem (sem
     * depender do cursor incremental), pra corrigir divergência quando o
     * histórico nunca alcança o "agora" (loja com volume de mudança maior
     * que o processado por ciclo).
     */
    public function reconciliarEstoque(SyncConexao $syncConexao, LinkProSyncService $service): RedirectResponse
    {
        $execucao = $service->reconciliarEstoqueCompleto($syncConexao);

        $mensagem = $execucao->status === 'sucesso'
            ? "Reconciliação completa concluída: {$execucao->estoque_atualizado} produto(s) de estoque corrigido(s)."
            : "Reconciliação falhou: {$execucao->erro}";

        return redirect()
            ->route('admin.sync-conexoes.index')
            ->with($execucao->status === 'sucesso' ? 'sucesso' : 'erro', $mensagem);
    }

    public function execucoes(SyncConexao $syncConexao): View
    {
        $execucoes = $syncConexao->execucoes()->orderByDesc('iniciado_em')->paginate(20);

        return view('admin.sync-conexoes.execucoes', compact('syncConexao', 'execucoes'));
    }

    /**
     * Testa a conexão Postgres com os dados do formulário (sem salvar nada).
     * Se a senha vier em branco (tela de edição, campo deixado vazio de
     * propósito), usa a senha já salva da conexão informada em "id".
     */
    public function testar(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'id' => ['nullable', 'integer', 'exists:sync_conexoes,id'],
            'host' => ['required', 'string'],
            'porta' => ['required', 'integer'],
            'database' => ['required', 'string'],
            'usuario' => ['required', 'string'],
            'senha' => ['nullable', 'string'],
            'ssl' => ['sometimes', 'boolean'],
        ]);

        $senha = $data['senha'] ?? '';
        if ($senha === '' && ! empty($data['id'])) {
            $senha = SyncConexao::findOrFail($data['id'])->senha;
        }

        try {
            $dsn = sprintf(
                'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
                $data['host'],
                $data['porta'],
                $data['database'],
                ($data['ssl'] ?? false) ? 'require' : 'prefer',
            );

            $pdo = new PDO($dsn, $data['usuario'], $senha, [
                PDO::ATTR_TIMEOUT => 5,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $pdo->query('select 1');
        } catch (PDOException $e) {
            return response()->json(['sucesso' => false, 'mensagem' => $e->getMessage()], 422);
        }

        return response()->json(['sucesso' => true, 'mensagem' => 'Conexão bem-sucedida.']);
    }

    private function validarDados(Request $request, bool $atualizando = false): array
    {
        $data = $request->validate([
            'nome' => ['required', 'string', 'max:255'],
            'loja_id' => ['required', 'integer', 'exists:lojas,id'],
            'host' => ['required', 'string', 'max:255'],
            'porta' => ['required', 'integer', 'min:1', 'max:65535'],
            'database' => ['required', 'string', 'max:255'],
            'usuario' => ['required', 'string', 'max:255'],
            'senha' => [$atualizando ? 'nullable' : 'required', 'string'],
            'ssl' => ['sometimes', 'boolean'],
            'ativo' => ['sometimes', 'boolean'],
            'sync_desde' => ['nullable', 'date'],
            'mapa_formas_pagamento' => ['nullable', 'json'],
            'janela_inicio' => ['array'],
            'janela_inicio.*' => ['nullable', 'date_format:H:i'],
            'janela_fim' => ['array'],
            'janela_fim.*' => [
                'nullable',
                'date_format:H:i',
                function (string $atributo, $valor, \Closure $falha) use ($request) {
                    $indice = explode('.', $atributo)[1] ?? null;
                    $inicio = $request->input("janela_inicio.$indice");
                    if ($inicio && $valor && $valor <= $inicio) {
                        $falha('O horário final deve ser depois do horário inicial.');
                    }
                },
            ],
        ]);

        $data['ssl'] = $request->boolean('ssl');
        $data['ativo'] = $request->boolean('ativo');

        if (! empty($data['mapa_formas_pagamento'])) {
            $data['mapa_formas_pagamento'] = json_decode($data['mapa_formas_pagamento'], true);
        }

        $data['janelas_funcionamento'] = $this->montarJanelas(
            $request->input('janela_inicio', []),
            $request->input('janela_fim', []),
        );
        unset($data['janela_inicio'], $data['janela_fim']);

        return $data;
    }

    /**
     * Junta os arrays paralelos janela_inicio[]/janela_fim[] do formulário
     * num array de {inicio, fim}, descartando linhas em branco (deixadas
     * vazias de propósito pra remover uma janela existente).
     */
    private function montarJanelas(array $inicios, array $fins): ?array
    {
        $janelas = [];

        foreach ($inicios as $indice => $inicio) {
            $fim = $fins[$indice] ?? null;
            if (! $inicio || ! $fim) {
                continue;
            }
            $janelas[] = ['inicio' => $inicio, 'fim' => $fim];
        }

        return $janelas === [] ? null : $janelas;
    }
}
