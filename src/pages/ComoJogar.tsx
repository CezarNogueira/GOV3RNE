import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * COMO JOGAR
 *
 * Tutorial em texto, não em pop-up. Seis blocos, cada um respondendo a uma
 * pergunta que o jogador realmente faz na primeira partida. A regra ao escrever
 * foi explicar a MECÂNICA e a razão dela, não listar botões.
 */
const SECTIONS = [
  {
    title: 'Como funciona o mês',
    body: [
      'O mandato tem 48 meses e cada mês é um turno. Você recebe uma cota de pontos de agenda — o tempo do presidente — e gasta como quiser: escrever uma medida, trabalhar votos no Congresso, receber um governador, falar em rede nacional, ou guardar o fim de semana e recuperar energia.',
      'Quando você avança o mês, tudo é processado de uma vez: as medidas executam, a economia roda, os grupos sociais reagem, o Congresso recalcula o apoio e a aprovação é fechada. O resultado aparece numa tela só, com o que subiu e o que caiu.',
      'A agenda do mês é o país batendo na porta. Em nove de cada dez meses ela traz alguma coisa: de um a três assuntos quando o governo está tranquilo, dois a cinco num mês comum, e de quatro a oito quando o governo está em crise. No décimo mês, ela vem limpa — e mês tranquilo também faz parte de governar.',
      'Quem aparece na sua agenda são as pessoas da SUA partida: o seu ministro provocando o governador do estado onde você tem base, o senador da sua base pego em vídeo, a estatal que você não privatizou, o país que compra a nossa soja, o seu cônjuge, o seu filho. Nada disso é um nome escrito no código — se você não tem cônjuge, esses eventos simplesmente não existem para você.',
      'Se houver evento pendente e você avançar sem decidir, o país decide por você — com metade do efeito e o dobro do desgaste. Não decidir também é uma decisão.',
      'Toda decisão sua devolve uma resposta na tela: o que ela mudou no país, indicador por indicador, e quem gostou e quem não gostou. Não é um texto pronto — o jogo compara o país antes e depois da sua ação e mostra a diferença. Quando a resposta é "nada mudou agora", ela também aparece, porque quase toda política pública leva meses para chegar ao indicador. Tudo isso fica guardado em Histórico → Suas decisões.',
    ],
  },
  {
    title: 'Como escrever propostas',
    body: [
      'Esta é a mecânica central. Você não escolhe entre botões prontos: você escreve, em português corrido, o que quer fazer. "Vou reduzir o imposto de importação do arroz por seis meses e liberar os estoques da Conab" é uma proposta válida.',
      'O sistema lê o texto e devolve uma ficha técnica: instrumento jurídico, custo estimado, prazo de execução, quem ganha, quem perde, se precisa do Congresso e qual o risco de ser derrubada no Supremo.',
      'A ficha aparece ANTES de você assinar. Ver a conta antes é a parte interessante: muita medida boa no discurso fica cara demais quando os números aparecem, e desistir também é jogar.',
      'Escreva os números. "Aumentar o salário mínimo" é um discurso; "aumentar o salário mínimo para R$ 1.800" é uma medida. Quando você diz o valor, o jogo calcula a partir dele: pega o valor vigente, mede a diferença, vê quanta gente é atingida e projeta o custo, a inflação, o emprego e a reação de cada grupo. R$ 1.700 e R$ 1.800 são medidas diferentes e produzem simulações diferentes — inclusive na conta que chega depois.',
      'Vale para qualquer número: alíquota ("reduzir o FGTS de 8% para 6%"), orçamento ("mais R$ 20 bilhões na saúde"), meta ("500 mil casas populares"), prazo ("por seis meses") e transição ("ao longo de dois anos"). O jogo entende "para" como valor final e "em" como acréscimo, e distingue ponto percentual de variação relativa: de 8% para 6% são 2 pontos a menos e um corte de 25%.',
      'Você não precisa saber o nome técnico de nada. Enquanto digita, o jogo mostra o que entendeu: a intenção, o alvo, os números lidos e o quanto ele tem certeza disso. Escreva "privatizar os Correios" e ele abre o processo daquela empresa; escreva "correius" com erro e ele chega na mesma; escreva "não quero privatizar os Correios" e ele não abre nada, porque leu a negativa.',
      'Quando a intenção é clara mas falta o como, o jogo abre um painel em vez de recusar a medida. "Cortar gastos" abre as dez pastas com a dotação real de cada uma e o quanto dá para cortar sem furar piso constitucional. "Reforma tributária" abre as alíquotas vigentes para você montar o pacote, que será votado de uma vez só. "Apoiar pequenas empresas" abre o repertório: crédito, tributo, encargo, garantia, burocracia, compras públicas. O painel escreve a medida por você — e daí em diante é o fluxo de sempre.',
      'Assinar não termina o assunto: se a medida depende do Congresso, a sessão é convocada na hora. Você negocia com as bancadas, encerra a negociação, assiste à apuração e vê a repercussão — tudo em sequência, cada fase confirmada por você. Fechar a tela no meio não cancela nada: a matéria fica onde parou, e se você nunca voltar a ela o Congresso vota sozinho alguns meses depois, sem nenhum acordo.',
    ],
  },
  {
    title: 'Como funciona o Congresso',
    body: [
      'São 513 deputados divididos em bancadas. Ninguém vota "no governo": cada bancada calcula ao mesmo tempo a distância ideológica da matéria, quanto o governo já pagou e se você ainda tem popularidade suficiente para valer a pena estar do seu lado.',
      'Presidente popular consegue voto quase de graça. Presidente em queda paga em emenda e ainda perde. É por isso que aprovação não é um troféu: é a moeda com que você compra maioria.',
      'O instrumento jurídico muda tudo. Decreto vale pela sua caneta, mas alcança pouco e é alvo fácil no Supremo. Medida provisória produz efeito imediato e caduca em quatro meses se o Congresso não converter — quando caduca, tudo volta atrás. PEC exige três quintos nas duas Casas e quase nunca passa.',
    ],
  },
  {
    title: 'Como funciona a economia',
    body: [
      'É um laço com defasagem, e entender esse laço é entender o jogo:',
      'Gastar sem lastro derruba a credibilidade fiscal. Credibilidade baixa sobe o risco-país. Risco alto desvaloriza o real. Real fraco encarece o importado e sobe a inflação. Inflação alta força o Copom a subir a Selic — e você não manda no Copom. Juro alto derruba o crescimento e sobe o desemprego.',
      'O laço leva de seis a doze meses para fechar. Isso é de propósito: o estrago aparece bem depois da decisão que o causou, então o presidente que só olha o mês corrente governa às cegas. Quando a inflação sobe no mês 22, a causa costuma estar escrita no mês 14.',
    ],
  },
  {
    title: 'Como funcionam as empresas',
    body: [
      'Vinte e oito grandes empresas brasileiras fazem parte da economia do jogo: catorze federais, das quais a União é sócia, e catorze privadas. Todo mês cada uma recalcula receita, lucro, imposto, investimento e quadro de funcionários a partir do cenário que você criou — e devolve isso para o desemprego, a arrecadação e o seu caixa.',
      'Cada empresa reage do seu jeito. Juro alto engorda o resultado de banco e sufoca indústria endividada. Dólar alto levanta exportador e aperta quem importa insumo. Cortar o FGTS patronal vale muito para quem emprega noventa mil pessoas e quase nada para quem emprega oito mil. É por isso que não existe medida econômica que agrade a todos: ela sempre escolhe um lado.',
      'Das estatais você recebe dividendo, não lucro: só o payout declarado, e só na proporção da participação da União. Nem toda estatal dá lucro — algumas começam no vermelho, e decidir o que fazer com elas (capitalizar, reestruturar, buscar sócio, privatizar ou não fazer nada) é parte do mandato.',
      'Privatizar não é um botão. A venda passa por proposta, estudos, autorização do Congresso quando a lei exige e leilão, que pode terminar deserto com a receita já gasta no orçamento. Comprar empresa privada custa valor de mercado mais prêmio de controle, e sem caixa vira dívida pública — com juro, risco-país e resultado fiscal pior no mês seguinte.',
      'Há dois caminhos para agir sobre uma empresa. O primeiro é escrever a medida: "privatizar os Correios" ou "estatizar a Vale" tramita como qualquer outro projeto e, se for aprovada, o processo societário abre sozinho — a medida é a autorização. O segundo é abrir a aba Economia, entrar na ficha da empresa e convocar a direção.',
      'A audiência custa um ponto de agenda, porque é tempo do presidente. Do outro lado da mesa senta uma pessoa com nome, tempo de casa e um jeito próprio de negociar: um técnico pede previsibilidade, um indicado político pede orçamento, alguém vindo do mercado pede tributo. Ela abre com a leitura que faz da própria empresa, usando os números daquele mês, e traz uma pauta de dois ou três pedidos.',
      'Você decide item a item: aceitar, negociar pela metade, fazer contraproposta exigindo investimento e emprego, ou recusar. Pode também oferecer o que ninguém pediu — baixar o imposto daquela empresa, abrir uma linha de crédito, assinar um contrato — e isso compra vontade a um preço. Sair da sala sem responder nada é a pior das saídas: a direção registra que foi recebida e ignorada, e a relação piora mais do que pioraria com um não.',
      'Respondeu, acabou: o item sai da pauta na hora e o efeito já entra no balanço da empresa, com o que mudou listado ao lado — investimento anual, quadro planejado, produção, ação, relação. Nenhuma das quatro respostas é neutra. Um não a uma empresa que está no vermelho vira plano de demissão, que aparece no desemprego alguns meses depois; um sim vira vaga, obra e imposto menor, com a conta no primário do mês. E o país lê tudo isso no noticiário empresarial.',
    ],
  },
  {
    title: 'Como funciona a aprovação',
    body: [
      'Não existe uma variável só. A aprovação nacional é montada de baixo para cima, a partir de 17 grupos sociais com sensibilidades próprias: o caminhoneiro sente diesel, o mercado sente inflação, o servidor sente reajuste, o agro sente fiscalização ambiental.',
      'O mesmo mês pode ser ótimo para um grupo e péssimo para outro. É por isso que a aprovação nacional se move devagar enquanto os blocos se movem rápido — e por que agradar todo mundo ao mesmo tempo é impossível.',
      'Existe ainda a aprovação pessoal, que sobrevive ao governo: as pessoas separam o presidente da administração. E existe o desgaste natural do cargo: todo governo perde apoio só por estar lá.',
    ],
  },
  {
    title: 'Como se ganha a reeleição',
    body: [
      'No quarto ano a eleição entra no calendário. Em abril o partido cobra uma resposta: você disputa ou não. Não disputar é legítimo — o governo vai até o último dia sem o desgaste da campanha, mas o Congresso passa a negociar com quem vem depois de você.',
      'Do outro lado está o líder da oposição que aparece no Painel desde o primeiro mês, com o partido dele e a estratégia que ele escolheu durante o seu mandato. Não é um adversário inventado no dia da eleição: é o que você deixou crescer.',
      'Quem decide a eleição é o país que você construiu. A intenção de voto é montada grupo por grupo a partir da aprovação de cada um, e depois somam-se as coisas que a aprovação não explica sozinha: preço da comida, emprego, promessa cumprida ou quebrada, escândalo, tamanho da base e palanque de governador. A eleição amplifica diferenças — com aprovação em 50 você ganha, em 40 vai para o segundo turno, em 30 perde feio.',
      'A campanha custa governo. Cada movimento — caravana, debate, palanque, aliança, campanha contra o adversário — vale uma vez, consome pontos de agenda que deixariam de virar medida e escolhe um lado do eleitorado. O debate é o de maior risco: pode render quatro pontos ou custar dois, dependendo do seu carisma e da sua energia.',
      'A pesquisa publicada não é o resultado: ela traz margem de erro, e a apuração usa o número real. No segundo turno, o voto de quem foi eliminado não vai para o mais votado — vai para quem o eleitor rejeita menos. É por isso que atacar o adversário é arriscado: sobe a rejeição dos dois.',
      'Ganhando, você governa mais 48 meses. O país continua exatamente como você o deixou — dívida, inflação, desemprego e cicatriz política —, mas o Congresso é renovado na mesma urna (vitória folgada puxa bancada), o desgaste dos ministros cai, a oposição se reorganiza atrás de outro nome e você escolhe cinco compromissos novos, medidos a partir de onde o país está hoje. E só existe uma reeleição: o segundo mandato termina em 96 meses.',
    ],
  },
  {
    title: 'Como o mandato termina',
    body: [
      'Ao fim do mandato — 48 meses, ou 96 se você se reelegeu —, o governo é avaliado em oito eixos: economia, responsabilidade fiscal, saúde, educação, segurança, desenvolvimento social, diplomacia e integridade institucional. Cada nota compara o país que você entrega com o país que você recebeu na primeira posse, não com um ideal abstrato.',
      'As cinco promessas em vigor são cobradas uma por uma, com o número atual ao lado. Quem se reelegeu é cobrado pelo programa do segundo mandato.',
      'O mandato também pode acabar antes. Impeachment exige três coisas ao mesmo tempo: aprovação baixa, base pequena e um assunto que a oposição consiga sustentar. Governo impopular com maioria sólida não cai; governo popular sem base também não. Cai quem perde os dois — e ainda assim são necessários 342 votos.',
    ],
  },
];

export function ComoJogar() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full">
      <div className="border-b border-ink-700 bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950">
        <div className="grid-lines absolute inset-x-0 h-40 opacity-25" aria-hidden />
        <div className="relative mx-auto max-w-3xl px-5 py-8">
          <button type="button" className="btn-ghost btn-sm" onClick={() => navigate('/')}>
            <ArrowLeft size={12} aria-hidden />
            Voltar
          </button>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase leading-none tracking-tight text-neutral-50 sm:text-5xl">
            Como jogar
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-neutral-400">
            O que entender antes do primeiro mês. Nada disso é sobre onde clicar.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="space-y-8">
          {SECTIONS.map((section, index) => (
            <section key={section.title}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-2xl text-gov-700">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-neutral-50">
                  {section.title}
                </h2>
              </div>
              <div className="mt-2 space-y-2.5 border-l-2 border-l-ink-700 pl-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-[14px] leading-relaxed text-neutral-400">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t border-ink-800 pt-6">
          <p className="text-[12px] leading-relaxed text-neutral-600">
            GOV3RNE é uma obra de ficção. Os indicadores partem de dados públicos do IBGE, do Banco
            Central e da Câmara dos Deputados e, a partir do primeiro mês jogado, passam a ser
            produzidos pelo motor de simulação — não representam a realidade e não devem ser lidos
            como previsão. Políticos, ministros, jornalistas, veículos de imprensa e empresas do
            jogo são fictícios. Siglas partidárias reais aparecem com atributos de simulação
            atribuídos pelo jogo, que não correspondem a posições oficiais de nenhuma legenda.
          </p>

          <button
            type="button"
            className="btn-primary mt-5 px-5 py-2.5 text-[13px]"
            onClick={() => navigate('/novo-mandato')}
          >
            Montar candidatura
          </button>
        </div>
      </div>
    </div>
  );
}
