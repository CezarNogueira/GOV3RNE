import { REGION_LABEL, formatCompact, type FederalUnit } from '@/game';
import { Modal } from '@/components/ui/overlays';
import { StatRow, cx } from '@/components/ui/primitives';

/**
 * PERFIL DE UM ESTADO
 *
 * Um só perfil para o jogo inteiro. Ele abre ao clicar num estado no mapa de
 * Nação e no mapa pequeno do Painel, e as duas telas mostram exatamente os
 * mesmos números: governador, aprovação do federal e os indicadores sociais e
 * políticos daquela unidade.
 */
export function StateProfileModal({
  unit,
  onClose,
}: {
  unit: FederalUnit | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={unit !== null}
      onClose={onClose}
      title={unit?.name ?? ''}
      subtitle={unit ? `${unit.capital} · ${REGION_LABEL[unit.region]}` : ''}
      size="md"
    >
      {unit && <StateDetail unit={unit} />}
    </Modal>
  );
}

export function StateDetail({ unit }: { unit: FederalUnit }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label">Governador</p>
          <p className="text-[15px] font-semibold text-neutral-100">{unit.governorName}</p>
          <p className="text-[11px] text-neutral-500">{unit.governorParty}</p>
        </div>
        <div className="text-right">
          <p className="label">Aprovação do federal</p>
          <p
            className={cx(
              'font-mono text-2xl',
              unit.approval >= 55 ? 'text-gov-400' : unit.approval >= 42 ? 'text-warn-400' : 'text-danger-400',
            )}
          >
            {unit.approval.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-3 rule pt-2">
        <StatRow label="População" value={formatCompact(unit.population)} />
        <StatRow label="Participação no PIB" value={`${unit.gdpShare.toFixed(2)}%`} />
        <StatRow label="Cadeiras na Câmara" value={`${unit.chamberSeats} deputados`} />
        <StatRow label="IDH" value={unit.hdi.toFixed(3)} />
        <StatRow label="Pobreza" value={`${unit.poverty.toFixed(1)}%`} tone={unit.poverty > 35 ? 'neg' : 'flat'} />
        <StatRow label="Desemprego" value={`${unit.unemployment.toFixed(1)}%`} />
        <StatRow label="Renda média" value={`R$ ${unit.income.toLocaleString('pt-BR')}`} />
        <StatRow label="Homicídios por 100 mil" value={unit.crime.toFixed(1)} />
        <StatRow label="Infraestrutura" value={`${unit.infrastructure.toFixed(0)}/100`} />
        <StatRow
          label="Relação com o Planalto"
          value={`${unit.governorRelation.toFixed(0)}/100`}
          tone={unit.governorRelation > 60 ? 'pos' : unit.governorRelation < 40 ? 'neg' : 'flat'}
        />
        <StatRow
          label="Ambição presidencial do governador"
          value={`${unit.governorAmbition.toFixed(0)}/100`}
          tone={unit.governorAmbition > 65 ? 'neg' : 'flat'}
          tip="Governador ambicioso ganha capital político atacando o Planalto quando o presidente está fraco."
        />
        <StatRow
          label="Tensão social"
          value={`${unit.unrest.toFixed(0)}/100`}
          tone={unit.unrest > 55 ? 'neg' : 'flat'}
        />
      </div>
    </div>
  );
}
