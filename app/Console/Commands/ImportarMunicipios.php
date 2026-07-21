<?php

namespace App\Console\Commands;

use App\Models\Municipio;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

#[Signature('app:importar-municipios')]
#[Description('Importa a lista de municípios do Brasil da API pública do IBGE pra tabela local (rodar uma vez; a lista quase nunca muda).')]
class ImportarMunicipios extends Command
{
    public function handle(): int
    {
        $this->info('Buscando municípios na API do IBGE...');

        $resposta = Http::timeout(30)->get('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');

        if (! $resposta->ok()) {
            $this->error('Falha ao consultar a API do IBGE: HTTP '.$resposta->status());

            return self::FAILURE;
        }

        $municipios = $resposta->json();
        $this->info(count($municipios).' municípios encontrados. Importando...');

        $barra = $this->output->createProgressBar(count($municipios));

        foreach ($municipios as $municipio) {
            $uf = $municipio['microrregiao']['mesorregiao']['UF']['sigla']
                ?? $municipio['regiao-imediata']['regiao-intermediaria']['UF']['sigla']
                ?? null;

            if (! $uf) {
                continue;
            }

            Municipio::updateOrCreate(
                ['codigo_ibge' => (string) $municipio['id']],
                [
                    'nome' => $municipio['nome'],
                    'nome_normalizado' => Municipio::normalizar($municipio['nome']),
                    'uf' => $uf,
                ],
            );

            $barra->advance();
        }

        $barra->finish();
        $this->newLine(2);
        $this->info('Importação concluída — '.Municipio::count().' municípios na base.');

        return self::SUCCESS;
    }
}
