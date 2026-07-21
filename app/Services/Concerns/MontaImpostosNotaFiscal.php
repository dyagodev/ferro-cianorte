<?php

namespace App\Services\Concerns;

use App\Models\Loja;
use stdClass;

/**
 * Montagem de ICMS/PIS/COFINS/IBS-CBS compartilhada entre NfceService (mod
 * 65) e NfeService (mod 55) — a regra tributária por item é a mesma nos
 * dois documentos, só muda o que embrulha em volta (ide, dest, DANFE...).
 * Ver ESCOPO ATUAL na doc de cada service pras limitações de cobertura de
 * CST/CSOSN.
 */
trait MontaImpostosNotaFiscal
{
    // 500 = ICMS cobrado anteriormente por substituição tributária (o
    // fornecedor já reteve o ICMS-ST na venda pra gente) — comum em
    // revenda de bebida, então incluído aqui de propósito: sem isso, o
    // código caía no fallback "101" (calcula vICMS com a alíquota do
    // grupo fiscal), o que duplicaria imposto já retido.
    private const CODIGOS_ICMS_SIMPLES_SEM_VALOR = ['102', '103', '300', '400', '500'];

    // 60 = ICMS já retido por substituição tributária (mesma lógica do 500
    // no Simples, ver acima) — a tag ICMS60 do XSD só tem campo pra
    // ICMS-ST RETIDO (vBCSTRet/vICMSSTRet, que não temos dado pra
    // preencher), nunca vBC/vICMS "normal". Retornar valor aqui inflava o
    // total (ICMSTot.vBC) sem nada correspondente em nenhuma tag de item,
    // rejeitado pela SEFAZ como "Total da BC ICMS difere do somatorio dos
    // itens" (visto na prática).
    private const CODIGOS_ICMS_NORMAL_SEM_VALOR = ['40', '41', '50', '60'];

    // CST cuja tag ICMS exige pRedBC preenchido (percentual de redução da
    // base de cálculo) — obrigatório no XSD mesmo quando o percentual é 0.
    private const CODIGOS_ICMS_COM_REDUCAO_BC = ['20', '70', '90'];

    private const CODIGOS_PIS_COFINS_ISENTOS = ['04', '05', '06', '07', '08', '09'];

    // CST 000 = tributação integral (LC 214/2025) — o único código que essa
    // service calcula valor de verdade pra IBS/CBS, ver montarIbsCbs().
    private const CST_IBSCBS_TRIBUTACAO_INTEGRAL = '000';

    // Alíquotas de teste pro período de apuração informativa de 2026 (não
    // são configuráveis por loja/produto). O total nacional de IBS teste é
    // 0,10% — não 0,05%/0,05% dividido entre UF e Município como o código
    // assumia antes (rejeitado na prática pela SEFAZ nos dois campos).
    // Município só existe de verdade quando aquele município específico já
    // publicou sua própria alíquota de teste (a maioria, incluindo
    // Floriano/PI, ainda não) — nesse caso os 0,10% inteiros vão pra UF e
    // o Município fica 0%. CBS é federal, 0,90% de qualquer lugar.
    private const ALIQUOTA_TESTE_IBS_UF_2026 = 0.10;

    private const ALIQUOTA_TESTE_IBS_MUN_2026 = 0.0;

    private const ALIQUOTA_TESTE_CBS_2026 = 0.90;

    /**
     * CRT (Código de Regime Tributário) da empresa dona da loja — 1 =
     * Simples Nacional, 3 = Regime Normal (Lucro Real/Presumido). Usado
     * tanto pra decidir ICMS (CSOSN vs CST) quanto se o grupo IBS/CBS entra
     * no XML.
     */
    private function crt(Loja $loja): string
    {
        return $loja->empresa?->regime_tributario === 'simples_nacional' ? '1' : '3';
    }

    /**
     * Retorna [stdClass pra tagICMS/tagICMSSN, vBC do item, vICMS do item] —
     * os dois últimos entram no somatório de ICMSTot (a lib não soma sozinha
     * a partir dos itens, ver TraitTagTotal::tagICMSTot).
     */
    private function montarIcms(int $nItem, $grupo, string $crt, float $totalItem): array
    {
        $std = new stdClass;
        $std->item = $nItem;
        $std->orig = '0';

        if ($crt === '1') {
            $csosn = $grupo?->csosn ?? '102';
            $std->CSOSN = $csosn;

            if (in_array($csosn, self::CODIGOS_ICMS_SIMPLES_SEM_VALOR, true)) {
                return [$std, 0.0, 0.0];
            }

            // 101 (com direito a crédito) e demais códigos — best effort,
            // usa a alíquota do grupo fiscal se houver; sem dado de
            // pCredSN/vCredICMSSN (não temos isso no cadastro), fica 0.
            $aliquota = $grupo?->aliquota_icms ? (float) $grupo->aliquota_icms : 0.0;
            $std->pCredSN = 0;
            $std->vCredICMSSN = 0;
            $std->modBC = 3;
            $std->vBC = $totalItem;
            $std->pICMS = $aliquota;
            $std->vICMS = round($totalItem * $aliquota / 100, 2);

            return [$std, $std->vBC, $std->vICMS];
        }

        $cst = $grupo?->cst_icms ?? '40';
        $std->CST = $cst;

        if (in_array($cst, self::CODIGOS_ICMS_NORMAL_SEM_VALOR, true)) {
            return [$std, 0.0, 0.0];
        }

        // CST 00 (tributação integral) e demais — best effort com a
        // alíquota do grupo fiscal.
        $aliquota = $grupo?->aliquota_icms ? (float) $grupo->aliquota_icms : 0.0;
        $std->modBC = 3;
        $std->vBC = $totalItem;

        // CST 20 (e 70/90, mesma mecânica) exige a tag pRedBC — sem redução
        // configurada no grupo fiscal (padrão 0%, até o contador confirmar
        // o percentual real), a base não reduz mas a tag ainda precisa ir
        // preenchida (a lib rejeita a nota com <pRedBC/> vazio, é campo
        // obrigatório no XSD pra esse CST, mesmo sem redução de verdade).
        if (in_array($cst, self::CODIGOS_ICMS_COM_REDUCAO_BC, true)) {
            $percentualReducao = $grupo?->percentual_reducao_bc ? (float) $grupo->percentual_reducao_bc : 0.0;
            $std->pRedBC = $percentualReducao;
            $std->vBC = round($totalItem * (1 - $percentualReducao / 100), 2);
        }

        $std->pICMS = $aliquota;
        $std->vICMS = round($std->vBC * $aliquota / 100, 2);

        return [$std, $std->vBC, $std->vICMS];
    }

    private function montarPis(int $nItem, $grupo, float $totalItem): array
    {
        $std = new stdClass;
        $std->item = $nItem;
        $cst = $grupo?->cst_pis ?? '07';
        $std->CST = $cst;

        if (in_array($cst, self::CODIGOS_PIS_COFINS_ISENTOS, true)) {
            return [$std, 0.0];
        }

        $aliquota = $grupo?->aliquota_pis ? (float) $grupo->aliquota_pis : 0.0;
        $std->vBC = $totalItem;
        $std->pPIS = $aliquota;
        $std->vPIS = round($totalItem * $aliquota / 100, 2);

        return [$std, $std->vPIS];
    }

    private function montarCofins(int $nItem, $grupo, float $totalItem): array
    {
        $std = new stdClass;
        $std->item = $nItem;
        $cst = $grupo?->cst_cofins ?? '07';
        $std->CST = $cst;

        if (in_array($cst, self::CODIGOS_PIS_COFINS_ISENTOS, true)) {
            return [$std, 0.0];
        }

        $aliquota = $grupo?->aliquota_cofins ? (float) $grupo->aliquota_cofins : 0.0;
        $std->vBC = $totalItem;
        $std->pCOFINS = $aliquota;
        $std->vCOFINS = round($totalItem * $aliquota / 100, 2);

        return [$std, $std->vCOFINS];
    }

    /**
     * IBS/CBS por item (NT 2025.002) — só chamada pra Regime Normal (CRT=3).
     * CST 000 (tributação integral, o default do grupo fiscal) calcula
     * valor de verdade com as alíquotas de teste 2026; qualquer outro CST
     * configurado no grupo fiscal (isenção, monofásico etc.) só manda
     * CST+cClassTrib sem o grupo de valores — best effort, não verificado
     * contra caso real.
     */
    private function montarIbsCbs(int $nItem, $grupo, float $totalItem): stdClass
    {
        $std = new stdClass;
        $std->item = $nItem;
        $std->CST = $grupo?->cst_ibscbs ?? self::CST_IBSCBS_TRIBUTACAO_INTEGRAL;
        $std->cClassTrib = $grupo?->cclasstrib_ibscbs ?? '000001';

        if ($std->CST !== self::CST_IBSCBS_TRIBUTACAO_INTEGRAL) {
            return $std;
        }

        $std->vBC = $totalItem;
        $std->gIBSUF_pIBSUF = self::ALIQUOTA_TESTE_IBS_UF_2026;
        $std->gIBSUF_vIBSUF = round($totalItem * self::ALIQUOTA_TESTE_IBS_UF_2026 / 100, 2);
        $std->gIBSMun_pIBSMun = self::ALIQUOTA_TESTE_IBS_MUN_2026;
        $std->gIBSMun_vIBSMun = round($totalItem * self::ALIQUOTA_TESTE_IBS_MUN_2026 / 100, 2);
        $std->gCBS_pCBS = self::ALIQUOTA_TESTE_CBS_2026;
        $std->gCBS_vCBS = round($totalItem * self::ALIQUOTA_TESTE_CBS_2026 / 100, 2);

        return $std;
    }
}
