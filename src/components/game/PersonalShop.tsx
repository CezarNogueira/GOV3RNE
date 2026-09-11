import { useState, type ReactNode } from 'react';
import { Car, Home, KeyRound, Ticket, Utensils } from 'lucide-react';
import {
  PERSONAL_CAR_BRANDS,
  PERSONAL_PROPERTY_KINDS,
  PERSONAL_SHOP,
  PERSONAL_SHOP_BY_ID,
  experienceDoneThisMonth,
  formatMoney,
  monthLabel,
  ownsPersonalItem,
  personalItemMonthlyCost,
  possessionValue,
  possessionsSummary,
  type PersonalCarBrand,
  type PersonalExperienceItem,
  type PersonalPropertyKind,
  type PersonalShopItem,
  type PersonalSpendingTier,
} from '@/game';
import { useGame } from '@/state/game-store';
import { Badge, Empty, Section, cx } from '../ui/primitives';

/**
 * GASTAR O DINHEIRO PESSOAL
 *
 * A vitrine da conta pessoal: restaurante e lazer, que se repetem uma vez por
 * mês, e carro e imóvel, que ficam no nome do presidente, cobram manutenção e
 * podem ser vendidos. Toda compra passa pelo motor, que decide o que o país
 * acha dela — aqui só se mostra o preço, a leitura pública e o botão.
 */

type Aba = 'restaurante' | 'lazer' | 'carro' | 'imovel' | 'bens';

const ABAS: { id: Aba; label: string; icon: typeof Car }[] = [
  { id: 'restaurante', label: 'Restaurantes', icon: Utensils },
  { id: 'lazer', label: 'Lazer', icon: Ticket },
  { id: 'carro', label: 'Carros', icon: Car },
  { id: 'imovel', label: 'Imóveis', icon: Home },
  { id: 'bens', label: 'Seus bens', icon: KeyRound },
];

const INTRO: Record<Aba, string> = {
  restaurante:
    'Cada lugar uma vez por mês. Tira estresse e melhora o humor — e restaurante caro também é foto, que o país vê.',
  lazer:
    'Também uma vez por mês cada. Descanso de verdade custa dinheiro; viagem cara custa aprovação.',
  carro:
    'Por segurança, o GSI não deixa o presidente dirigir em via pública: o carro fica na garagem da Granja do Torto. Mas está no seu nome, na declaração ao TSE e, se for caro, no jornal. IPVA, seguro e revisão saem todo mês.',
  imovel:
    'Condomínio, IPTU e manutenção saem da conta todo mês. Casa de praia, de campo e sítio aliviam o estresse; cobertura de R$ 20 milhões alivia outra coisa e custa aprovação.',
  bens:
    'Carro perde valor desde o dia em que sai da loja; imóvel se valoriza devagar, mas a corretagem come um pedaço. Se a conta ficar negativa, o bem mais caro de manter é vendido às pressas.',
};

const LEITURA: Record<PersonalSpendingTier, { label: string; tone: 'gov' | 'neutral' | 'warn' | 'danger' }> = {
  popular: { label: 'Popular', tone: 'gov' },
  discreto: { label: 'Discreto', tone: 'neutral' },
  confortavel: { label: 'Confortável', tone: 'neutral' },
  luxo: { label: 'Luxo', tone: 'warn' },
  ostentacao: { label: 'Ostentação', tone: 'danger' },
};

export function PersonalShop() {
  const state = useGame((store) => store.state);
  const spend = useGame((store) => store.spendPersonal);
  const sell = useGame((store) => store.sellPossession);
  const [aba, setAba] = useState<Aba>('restaurante');
  const [marca, setMarca] = useState<PersonalCarBrand | 'todas'>('todas');
  const [tipo, setTipo] = useState<PersonalPropertyKind | 'todos'>('todos');
  const [confirmando, setConfirmando] = useState<string | null>(null);

  if (!state) return null;

  const saldo = state.president.personalWealth;
  const encerrado = state.flags.gameOver;
  const resumo = possessionsSummary(state);

  const itens = PERSONAL_SHOP.filter((item) => {
    if (item.category !== aba) return false;
    if (item.category === 'carro' && marca !== 'todas') return item.brand === marca;
    if (item.category === 'imovel' && tipo !== 'todos') return item.kind === tipo;
    return true;
  });

  const trocarAba = (proxima: Aba) => {
    setAba(proxima);
    setConfirmando(null);
  };

  return (
    <Section
      title="Gastar o dinheiro pessoal"
      action={<span className="font-mono text-[12px] text-gov-400">{formatMoney(saldo)} na conta</span>}
    >
      <div className="flex flex-wrap gap-1">
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={cx('option flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]', aba === id && 'option-selected')}
            onClick={() => trocarAba(id)}
          >
            <Icon size={13} aria-hidden />
            {label}
            {id === 'bens' && resumo.count > 0 && (
              <span className="font-mono text-[10px] text-neutral-500">{resumo.count}</span>
            )}
          </button>
        ))}
      </div>

      {aba === 'carro' && (
        <Filtros
          opcoes={[{ id: 'todas', label: 'Todas' }, ...PERSONAL_CAR_BRANDS.map((brand) => ({ id: brand, label: brand }))]}
          ativo={marca}
          onChange={(id) => setMarca(id as PersonalCarBrand | 'todas')}
        />
      )}
      {aba === 'imovel' && (
        <Filtros
          opcoes={[{ id: 'todos', label: 'Todos' }, ...PERSONAL_PROPERTY_KINDS]}
          ativo={tipo}
          onChange={(id) => setTipo(id as PersonalPropertyKind | 'todos')}
        />
      )}

      <p className="mt-2 text-[11px] leading-snug text-neutral-600">{INTRO[aba]}</p>

      {aba === 'bens' ? (
        resumo.count === 0 ? (
          <div className="mt-3">
            <Empty>Nada no seu nome além do salário. Carro e imóvel comprados aparecem aqui.</Empty>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 border border-ink-700 bg-ink-900/40 p-2.5">
              <Numero rotulo="Bens" valor={String(resumo.count)} />
              <Numero rotulo="Valem hoje" valor={formatMoney(resumo.marketValue)} />
              <Numero rotulo="Custam por mês" valor={formatMoney(resumo.monthlyCost)} />
            </div>
            <ul className="mt-2">
              {(state.president.possessions ?? []).map((bem) => {
                const item = PERSONAL_SHOP_BY_ID[bem.itemId];
                const valor = possessionValue(state, bem);
                const mensal = item ? personalItemMonthlyCost(item) : 0;
                return (
                  <li
                    key={bem.id}
                    className="flex flex-wrap items-center gap-3 border-b border-ink-800 py-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-neutral-200">{item?.name ?? 'Bem pessoal'}</p>
                      <p className="text-[11px] text-neutral-600">
                        Comprado em {monthLabel(bem.boughtMonth, state.startYear)} por{' '}
                        {formatMoney(bem.pricePaid)} · {formatMoney(mensal)} por mês
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="label">Vale hoje</p>
                      <p
                        className={cx(
                          'font-mono text-[13px]',
                          valor >= bem.pricePaid ? 'text-gov-400' : 'text-danger-400',
                        )}
                      >
                        {formatMoney(valor)}
                      </p>
                    </div>
                    {confirmando === bem.id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => {
                            sell(bem.id);
                            setConfirmando(null);
                          }}
                        >
                          Vender por {formatMoney(valor)}
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmando(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={encerrado}
                        onClick={() => setConfirmando(bem.id)}
                      >
                        Vender
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {itens.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              saldo={saldo}
              encerrado={encerrado}
              meu={ownsPersonalItem(state, item.id)}
              feito={experienceDoneThisMonth(state, item.id)}
              confirmando={confirmando === item.id}
              onPedir={() => setConfirmando(item.id)}
              onCancelar={() => setConfirmando(null)}
              onComprar={() => {
                spend(item.id);
                setConfirmando(null);
              }}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function Filtros({
  opcoes,
  ativo,
  onChange,
}: {
  opcoes: { id: string; label: string }[];
  ativo: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1 border-t border-ink-800 pt-2">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          className={cx('option px-2 py-1 text-[11px]', ativo === opcao.id && 'option-selected')}
          onClick={() => onChange(opcao.id)}
        >
          {opcao.label}
        </button>
      ))}
    </div>
  );
}

function efeitosDaExperiencia(item: PersonalExperienceItem): string {
  const e = item.effects;
  const partes = [`${e.stress} estresse`, `+${e.mood} humor`];
  if (e.energy) partes.push(`${e.energy > 0 ? '+' : ''}${e.energy} energia`);
  if (e.health) partes.push(`${e.health > 0 ? '+' : ''}${e.health} saúde`);
  if (e.spouseStress) partes.push('alivia o cônjuge');
  return partes.join(' · ');
}

function ItemCard({
  item,
  saldo,
  encerrado,
  meu,
  feito,
  confirmando,
  onPedir,
  onCancelar,
  onComprar,
}: {
  item: PersonalShopItem;
  saldo: number;
  encerrado: boolean;
  meu: boolean;
  feito: boolean;
  confirmando: boolean;
  onPedir: () => void;
  onCancelar: () => void;
  onComprar: () => void;
}) {
  const leitura = LEITURA[item.tier];
  const falta = item.price - saldo;
  const mensal = personalItemMonthlyCost(item);

  const topo = item.category === 'carro' ? item.brand : item.category === 'imovel' ? item.city : item.detail;
  const linha =
    item.category === 'carro' || item.category === 'imovel' ? item.detail : efeitosDaExperiencia(item);
  const refugio = item.category === 'imovel' && item.monthlyStress <= -1;

  let acao: ReactNode;
  if (meu) {
    acao = <Badge tone="gov">Está no seu nome</Badge>;
  } else if (feito) {
    acao = <span className="label">Feito este mês</span>;
  } else if (falta > 0) {
    acao = <span className="text-[11px] text-neutral-600">Faltam {formatMoney(falta)}</span>;
  } else if (item.category === 'restaurante' || item.category === 'lazer') {
    acao = (
      <button type="button" className="btn-ghost btn-sm" disabled={encerrado} onClick={onComprar}>
        {item.category === 'restaurante' ? 'Ir' : 'Fazer'}
      </button>
    );
  } else if (confirmando) {
    acao = (
      <div className="flex gap-1">
        <button type="button" className="btn-primary btn-sm" onClick={onComprar}>
          Confirmar compra
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    );
  } else {
    acao = (
      <button type="button" className="btn-ghost btn-sm" disabled={encerrado} onClick={onPedir}>
        Comprar
      </button>
    );
  }

  return (
    <li
      className={cx(
        'flex flex-col border bg-ink-900/40 p-3',
        meu ? 'border-gov-700/70' : 'border-ink-700',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="label truncate">{topo}</p>
          <p className="mt-0.5 text-[13px] font-semibold leading-snug text-neutral-100">{item.name}</p>
          <p className="mt-0.5 font-mono text-[10px] leading-snug text-neutral-500">{linha}</p>
        </div>
        <Badge tone={leitura.tone}>{leitura.label}</Badge>
      </div>

      <p className="mt-2 text-[12px] leading-snug text-neutral-500">{item.blurb}</p>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
        <div>
          <p className="font-mono text-[14px] text-neutral-50">{formatMoney(item.price)}</p>
          {mensal > 0 && (
            <p className="text-[10px] text-neutral-600">
              + {formatMoney(mensal)} por mês{refugio ? ' · alivia o estresse' : ''}
            </p>
          )}
        </div>
        {acao}
      </div>
    </li>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="label">{rotulo}</p>
      <p className="mt-0.5 font-mono text-[13px] text-neutral-100">{valor}</p>
    </div>
  );
}
