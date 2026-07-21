<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loja;
use App\Models\ManifestoTransporte;
use App\Services\MdfeService;
use App\Support\TenantContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class ManifestoTransporteController extends Controller
{
    public function __construct(private MdfeService $mdfe)
    {
    }

    public function index(Request $request)
    {
        $query = ManifestoTransporte::with(['loja', 'veiculoTracao'])->orderByDesc('created_at');

        if ($lojaId = $request->integer('loja_id')) {
            $query->where('loja_id', $lojaId);
        }

        return $query->paginate(30);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $manifesto = DB::transaction(function () use ($data) {
            $loja = Loja::findOrFail($data['loja_id']);

            // Numeração sequencial é responsabilidade nossa (sem gateway
            // assumindo isso) — trava a linha da loja pra não dar número
            // repetido em duas emissões simultâneas.
            $loja = Loja::whereKey($loja->id)->lockForUpdate()->first();
            $numero = $loja->mdfe_proximo_numero;
            $loja->increment('mdfe_proximo_numero');

            $manifesto = ManifestoTransporte::create([
                ...$data,
                'numero' => $numero,
                'codigo_numerico' => str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT),
                'status' => 'rascunho',
            ]);

            foreach ($data['documentos'] as $documento) {
                $manifesto->documentos()->create($documento);
            }
            $manifesto->condutores()->sync($data['condutor_ids']);
            if (! empty($data['reboque_ids'])) {
                $manifesto->reboques()->sync($data['reboque_ids']);
            }

            if (! empty($data['transferencia_estoque_id'])) {
                \App\Models\TransferenciaEstoque::whereKey($data['transferencia_estoque_id'])
                    ->update(['manifesto_transporte_id' => $manifesto->id]);
            }

            return $manifesto;
        });

        return response()->json($manifesto->load(['documentos', 'condutores', 'reboques']), 201);
    }

    public function show(ManifestoTransporte $manifesto)
    {
        return $manifesto->load(['loja', 'veiculoTracao', 'documentos', 'condutores', 'reboques']);
    }

    public function update(Request $request, ManifestoTransporte $manifesto)
    {
        if (! $manifesto->editavel()) {
            return response()->json(['message' => 'Só é possível editar manifesto em rascunho.'], 422);
        }

        $data = $this->validated($request, sometimes: true);
        $manifesto->update($data);

        if (isset($data['documentos'])) {
            $manifesto->documentos()->delete();
            foreach ($data['documentos'] as $documento) {
                $manifesto->documentos()->create($documento);
            }
        }
        if (isset($data['condutor_ids'])) {
            $manifesto->condutores()->sync($data['condutor_ids']);
        }
        if (isset($data['reboque_ids'])) {
            $manifesto->reboques()->sync($data['reboque_ids']);
        }

        return $manifesto->load(['documentos', 'condutores', 'reboques']);
    }

    public function destroy(ManifestoTransporte $manifesto)
    {
        if (! $manifesto->editavel()) {
            return response()->json(['message' => 'Só é possível excluir manifesto em rascunho.'], 422);
        }

        $manifesto->delete();

        return response()->json(null, 204);
    }

    /**
     * Assina e envia o MDF-e pra SEFAZ — síncrono de propósito (o operador
     * fica esperando a resposta na hora, diferente da NFC-e do PDV que é
     * fire-and-forget). Ver MdfeService::emitir pro que pode dar errado.
     */
    public function emitir(ManifestoTransporte $manifesto)
    {
        if ($manifesto->status !== 'rascunho') {
            return response()->json(['message' => 'Esse manifesto já foi enviado antes.'], 422);
        }

        try {
            $this->mdfe->emitir($manifesto);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Falha inesperada ao emitir: '.$e->getMessage()], 500);
        }

        return $manifesto->fresh(['documentos', 'condutores', 'reboques']);
    }

    private function validated(Request $request, bool $sometimes = false): array
    {
        $regra = $sometimes ? ['sometimes', 'required'] : ['required'];

        return $request->validate([
            'loja_id' => [...$regra, 'exists:lojas,id'],
            // Rastreabilidade opcional — de qual transferência esse
            // manifesto veio (ver TransferenciaEstoqueController). Escopado
            // pelo tenant atual, mesmo raciocínio de VendaController.
            'transferencia_estoque_id' => [
                'nullable',
                Rule::exists('transferencias_estoque', 'id')->where('empresa_id', TenantContext::id()),
            ],
            'veiculo_tracao_id' => [...$regra, 'exists:veiculos,id'],
            'tp_emitente' => ['nullable', 'in:1,2,3'],
            'serie' => ['nullable', 'string', 'max:3'],
            'uf_ini' => [...$regra, 'string', 'size:2'],
            'uf_fim' => [...$regra, 'string', 'size:2'],
            'municipio_carregamento_codigo' => [...$regra, 'string', 'max:7'],
            'municipio_carregamento_nome' => [...$regra, 'string', 'max:255'],
            'municipio_descarga_codigo' => [...$regra, 'string', 'max:7'],
            'municipio_descarga_nome' => [...$regra, 'string', 'max:255'],
            'tipo_carga' => ['nullable', 'string', 'max:2'],
            'descricao_produto' => [...$regra, 'string', 'max:255'],
            'ncm' => ['nullable', 'string', 'max:8'],
            'valor_carga' => [...$regra, 'numeric', 'min:0'],
            'peso_carga_kg' => [...$regra, 'numeric', 'min:0'],
            'dh_inicio_viagem' => ['nullable', 'date'],
            'documentos' => [...$regra, 'array', 'min:1'],
            'documentos.*.tipo' => ['required', 'in:nfe,cte'],
            'documentos.*.chave' => ['required', 'string', 'size:44'],
            'condutor_ids' => [...$regra, 'array', 'min:1'],
            'condutor_ids.*' => ['exists:condutores,id'],
            'reboque_ids' => ['nullable', 'array'],
            'reboque_ids.*' => ['exists:veiculos,id'],
        ]);
    }
}
