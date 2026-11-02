import { GROUPS, GROUP_IDS } from '@/game';
import { useGame } from '@/state/game-store';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { GroupMeter } from '@/components/game/parts';

export function Sociedade() {
  const state = useGame((s) => s.state);
  if (!state) return null;
  return (
    <>
      <PageHeader place="Palácio do Planalto" title="Sociedade" tint="green" />
      <PageBody>
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-3 xl:grid-cols-5 select-none">
          {GROUP_IDS.map((id) => (
            <section key={id} className="space-y-2" aria-label={GROUPS[id].label}>
              <GroupMeter id={id} value={state.society[id]} delta={state.society[id] - state.turn.start.society[id]} />
              <div className="card space-y-2 p-3 text-[12.5px]">
                <div>
                  <p className="label text-gov-400">Fica satisfeito com</p>
                  <ul className="mt-0.5 list-disc pl-4 text-neutral-300">{GROUPS[id].likes.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
                <div>
                  <p className="label text-danger-400">Fica insatisfeito com</p>
                  <ul className="mt-0.5 list-disc pl-4 text-neutral-300">{GROUPS[id].dislikes.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
              </div>
            </section>
          ))}
        </div>
      </PageBody>
    </>
  );
}
