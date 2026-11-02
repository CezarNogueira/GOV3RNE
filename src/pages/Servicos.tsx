import {
  GROUP_LABEL,
  RESOURCES,
  RESOURCE_LABEL,
  SERVICE_BLURB,
  SERVICE_IDS,
  SERVICE_LABEL,
  type GroupId,
  type ServiceId,
} from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { ServiceMeter, Sparkline } from '@/components/game/parts';

/** Quem fica satisfeito quando o serviço sobe (lista de gostos de cada grupo). */
const PLEASES: Record<ServiceId, GroupId[]> = {
  saude: ['pobres'],
  educacao: ['pobres', 'ricos'],
  seguranca: ['militares'],
  agricultura: ['empresarios'],
  infraestrutura: ['militares', 'empresarios'],
};

export function Servicos() {
  const state = useGame((s) => s.state);
  if (!state) return null;

  return (
    <>
      <PageHeader place="Ministérios" title="Serviços" tint="blue" />
      <PageBody>
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-5 select-none">
          {SERVICE_IDS.map((id) => {
            const drives = (Object.keys(RESOURCES) as (keyof typeof RESOURCES)[]).filter((r) => (RESOURCES[r].influences[id] ?? 0) > 0);
            const series = [...state.history.map((h) => h.services[id]), state.services[id]];
            return (
              <section key={id} className="space-y-2" aria-label={SERVICE_LABEL[id]}>
                <ServiceMeter id={id} value={state.services[id]} target={state.turn.targets[id]} delta={state.services[id] - state.turn.start.services[id]} />
                <div className="card space-y-2 p-3 text-[12.5px]">
                  <p className="text-neutral-400">{SERVICE_BLURB[id]}</p>
                  <p><span className="label">Alimenta · </span>{drives.map((r) => `${RESOURCE_LABEL[r]}${(RESOURCES[r].influences[id] ?? 0) > 1 ? `` : ''}`).join(', ')}</p>
                  <p><span className="label">Agrada · </span>{PLEASES[id].map((g) => GROUP_LABEL[g]).join(', ')}</p>
                  <div className="text-gov-400"><Sparkline values={series} label={`Evolução de ${SERVICE_LABEL[id]}`} /></div>
                </div>
              </section>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
