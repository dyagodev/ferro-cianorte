<?php

namespace Database\Seeders;

use App\Models\Cliente;
use App\Models\Fornecedor;
use App\Models\Loja;
use App\Models\Produto;
use App\Models\ProdutoEstoque;
use Illuminate\Database\Seeder;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Importa os cadastros exportados do Link Pro (storage/app/*.xls) pro Ferro
 * Cianorte. Não roda no `db:seed` padrão — é opcional e sob demanda:
 *
 *   php artisan db:seed --class=ImportarPlanilhasLinkProSeeder
 *
 * Reexecutável sem duplicar: fornecedores casam por CNPJ, produtos por
 * código de barras (ou descrição quando não tem código), clientes por nome
 * (a planilha do Link Pro não traz CPF/CNPJ do cliente).
 */
class ImportarPlanilhasLinkProSeeder extends Seeder
{
    public function run(): void
    {
        $this->importarFornecedores();
        $this->importarClientes();
        $this->importarProdutos();
    }

    private function importarFornecedores(): void
    {
        $linhas = $this->lerLinhas('Forncedores.xls');
        $total = 0;

        foreach ($linhas as $linha) {
            [, $razaoSocial, $nomeFantasia, $cnpj, $inativo] = $linha;

            if ($this->ehVerdadeiro($inativo)) {
                continue;
            }

            $cnpj = trim((string) $cnpj) ?: null;
            $nome = trim((string) $razaoSocial) ?: trim((string) $nomeFantasia);

            if ($nome === '') {
                continue;
            }

            $chave = $cnpj ? ['cnpj' => $cnpj] : ['nome' => $nome];

            Fornecedor::updateOrCreate($chave, [
                'nome' => $nome,
                'cnpj' => $cnpj,
                'contato' => trim((string) $nomeFantasia) ?: null,
            ]);

            $total++;
        }

        $this->command?->info("Fornecedores importados: {$total}");
    }

    private function importarClientes(): void
    {
        $linhas = $this->lerLinhas('Clientes.xls');
        $total = 0;

        foreach ($linhas as $linha) {
            [, $nome, , $apelido, $fone, , $inativo] = $linha;

            if ($this->ehVerdadeiro($inativo)) {
                continue;
            }

            $nome = trim((string) $apelido) ?: trim((string) $nome);

            if ($nome === '') {
                continue;
            }

            Cliente::updateOrCreate(['nome' => $nome], [
                'telefone' => trim((string) $fone) ?: null,
            ]);

            $total++;
        }

        $this->command?->info("Clientes importados: {$total}");
    }

    private function importarProdutos(): void
    {
        $linhas = $this->lerLinhas('Itens.xls');
        $lojas = Loja::pluck('id');

        if ($lojas->isEmpty()) {
            $this->command?->warn('Nenhuma loja cadastrada — rode o DatabaseSeeder principal antes deste.');

            return;
        }

        $total = 0;

        foreach ($linhas as $linha) {
            [$codigoInterno, $codigoBarras, $descricao, $unidade, $marca, $estoque, $estoqueMinimo, $precoCusto, , , $precoVenda] = $linha;

            $descricao = trim((string) $descricao);
            if ($descricao === '') {
                continue;
            }

            $codigoInterno = trim((string) $codigoInterno) ?: null;
            $codigoBarras = trim((string) $codigoBarras) ?: null;
            $precoCustoNum = $this->parseDecimalBr($precoCusto);
            $precoVendaNum = $this->parseDecimalBr($precoVenda);
            $margem = $precoCustoNum > 0 ? round((($precoVendaNum - $precoCustoNum) / $precoCustoNum) * 100, 2) : 0;

            // Casa primeiro pelo código de barras — é a chave que a primeira
            // importação já usou pra criar o produto, então re-rodar (ex.:
            // pra preencher o código interno num catálogo já importado) acha
            // a linha certa em vez de tentar criar duplicata. Novo item sem
            // código de barras casa pelo código interno (a etiqueta que a
            // própria loja gera — mais confiável que o de fábrica, que muita
            // peça solta de ferragem não tem) e por último pela descrição.
            $chave = $codigoBarras
                ? ['codigo_barras' => $codigoBarras]
                : ($codigoInterno ? ['codigo_interno' => $codigoInterno] : ['descricao' => $descricao]);

            $produto = Produto::updateOrCreate($chave, [
                'codigo_interno' => $codigoInterno,
                'codigo_barras' => $codigoBarras,
                'descricao' => $descricao,
                'unidade' => trim((string) $unidade) ?: 'UN',
                'marca' => trim((string) $marca) ?: null,
                'preco_custo' => $precoCustoNum,
                'margem_percentual' => $margem,
                'preco_venda' => $precoVendaNum,
                'estoque_minimo' => (int) round($this->parseDecimalBr($estoqueMinimo)),
                'ativo' => true,
            ]);

            // A planilha só traz um total de estoque (sem separar por loja);
            // por decisão de negócio, replicamos essa mesma quantidade pra
            // cada loja cadastrada, em vez de dividir ou escolher uma só.
            $quantidade = (int) round($this->parseDecimalBr($estoque));
            foreach ($lojas as $lojaId) {
                ProdutoEstoque::updateOrCreate(
                    ['produto_id' => $produto->id, 'loja_id' => $lojaId],
                    ['quantidade' => $quantidade],
                );
            }

            $total++;
        }

        $this->command?->info("Produtos importados: {$total}");
    }

    /**
     * Lê um .xls de storage/app e devolve as linhas (sem o cabeçalho) como
     * arrays de valores brutos (strings, como o Link Pro exporta).
     *
     * @return array<int, array<int, string>>
     */
    private function lerLinhas(string $arquivo): array
    {
        $caminho = storage_path('app/'.$arquivo);

        if (! file_exists($caminho)) {
            $this->command?->warn("Arquivo não encontrado: {$arquivo} (esperado em storage/app/).");

            return [];
        }

        $planilha = IOFactory::load($caminho);
        /** @var Worksheet $aba */
        $aba = $planilha->getActiveSheet();

        $linhas = $aba->toArray(null, true, true, false);
        array_shift($linhas); // descarta o cabeçalho

        return $linhas;
    }

    private function ehVerdadeiro(mixed $valor): bool
    {
        return in_array(trim((string) $valor), ['True', '1', 'Sim'], true);
    }

    private function parseDecimalBr(mixed $valor): float
    {
        $valor = trim((string) $valor);
        if ($valor === '') {
            return 0.0;
        }

        // "1.234,56" -> "1234.56"
        $valor = str_replace('.', '', $valor);
        $valor = str_replace(',', '.', $valor);

        return (float) $valor;
    }
}
