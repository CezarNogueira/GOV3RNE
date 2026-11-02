import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  CRISIS,
  DEBT,
  GDP_MONTHS_TO_OVERTAKE,
  OFFERED_CARD_COUNT,
  RESOURCE_IDS,
  RESOURCES,
  formatReais,
} from '@/game';

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="section-title text-xl">{title}</h2>
      <div className="mt-1 space-y-1.5 text-[13.5px] leading-relaxed text-neutral-300">{children}</div>
    </section>
  );
}

export function ComoJogar() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 py-8 sm:px-6">
      <button type="button" className="btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={12} aria-hidden /> Voltar</button>
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-neutral-50">Como jogar</h1>

      <Rule title="Uma decisão por mês">
        <p>Todo mês aparecem {OFFERED_CARD_COUNT} cartas de medidas diferentes. Você vê as três e escolhe <strong>uma</strong>. Cada carta mostra categoria, o que afeta, a chance de sucesso, o que muda se der certo e se der errado, o custo e a reação dos grupos sociais.</p>
        <p>Se a medida fracassar, o dinheiro continua gasto, mas o efeito não vem. Depois da escolha você vê as consequências e avança o mês.</p>
      </Rule>

      <Rule title="Serviços e metas">
        <p>Saúde, Educação, Segurança, Agricultura e Infraestrutura começam em 50 e vão de 0 a 100. Todo mês alguns serviços ganham uma meta de 0 a 2 pontos acima do valor atual, fixa até o fechamento.</p>
        <p>Todos os serviços com meta cumpridos: <strong>IDH +1</strong>. Algum abaixo: <strong>IDH −1</strong>. Agricultura e Educação cumpridas: <strong>Comércio +5</strong>; se uma falhar: <strong>Comércio −20</strong>.</p>
      </Rule>

      <Rule title="Moeda e dívida">
        <p>A moeda começa em US$ 0,20. Se o Comércio sobe, há 50% de chance de ela ganhar US$ 0,05; se não sobe, 25% de chance de perder US$ 0,10.</p>
        <p>A dívida começa em {DEBT.initial}%. Acima de {DEBT.riskFreeUpTo}% há 10% de chance mensal de perder US$ 0,10, e +10 pontos a cada {DEBT.riskBandWidth} pontos de dívida.</p>
      </Rule>

      <Rule title="Ranking de PIB">
        <p>Você começa em 10º. Para ultrapassar o país de cima, os cinco serviços precisam estar acima dos dele por {GDP_MONTHS_TO_OVERTAKE} meses seguidos. Cada posição conquistada paga uma recompensa uma única vez, em IDH ou no valor da moeda.</p>
      </Rule>

      <Rule title="Recursos e dinheiro">
        <p>Cada ponto de recurso rende dinheiro todo mês:</p>
        <ul className="list-disc pl-5">
          {RESOURCE_IDS.map((id) => <li key={id}>{RESOURCES[id].label}: {formatReais(RESOURCES[id].revenuePerPoint)} por ponto</li>)}
        </ul>
        <p>Os recursos crescem devagar conforme os serviços avançam. Impostos e gastos são recorrentes: a medida muda o valor mensal até outra mexer nele. Cofre final = cofre + impostos + receita dos recursos − gastos − custos das medidas.</p>
        <p>Cofre negativo inicia uma <strong>crise financeira</strong> de {CRISIS.months} meses: gastos zerados, serviços e recursos em queda e grupos insatisfeitos.</p>
      </Rule>

      <Rule title="Sociedade e derrota">
        <p>Pobres, Ricos, Militares, Indígenas e Empresários começam em 50. Cada medida agrada uns e desagrada outros: obras, por exemplo, desagradam os indígenas.</p>
        <p><strong>Você perde</strong> se qualquer serviço, recurso ou grupo chegar a 0, ou se a moeda chegar a US$ 0. Não há limite de meses: o jogo segue até a derrota.</p>
      </Rule>

      <button type="button" className="btn-primary" onClick={() => navigate('/novo-mandato')}>Começar um mandato</button>
    </div>
  );
}
