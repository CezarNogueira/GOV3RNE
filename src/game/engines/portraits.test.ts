import { describe, expect, it } from 'vitest';
import { DECLARED_PORTRAITS, portraitFor } from '../data/portraits';
import { MINISTER_POOL, VICE_POOL } from '../data/people';
import { BEARD_STYLES, HAIR_STYLES, OUTFITS, SKIN_TONES, HAIR_COLORS } from '../data/avatar';

/**
 * RETRATOS DO ELENCO
 *
 * Todo mundo que aparece numa lista de escolha tem rosto, montado pelo MESMO
 * montador que o jogador usa para si. Para as pessoas reais da divisao
 * "famosos" a aparencia e declarada a mao; para o elenco ficticio ela e
 * sorteada do id e nunca muda.
 */
describe('todo mundo tem rosto', () => {
  it('da retrato a cada nome da chapa e do gabinete', () => {
    for (const candidate of [...VICE_POOL, ...MINISTER_POOL]) {
      expect(candidate.avatar, candidate.name).toBeTruthy();
      expect(SKIN_TONES).toContain(candidate.avatar.skin);
      expect(HAIR_COLORS).toContain(candidate.avatar.hair);
      expect(HAIR_STYLES.map((entry) => entry.id)).toContain(candidate.avatar.hairStyle);
      expect(BEARD_STYLES.map((entry) => entry.id)).toContain(candidate.avatar.beard);
      expect(OUTFITS.map((entry) => entry.id)).toContain(candidate.avatar.outfit);
    }
  });

  it('declara a aparencia de toda pessoa real, sem cair no sorteio', () => {
    const reais = [...VICE_POOL, ...MINISTER_POOL].filter(
      (candidate) => candidate.origin === 'famoso',
    );
    expect(reais.length).toBeGreaterThan(35);

    // Pessoa real com retrato sorteado sairia com a cara de outra pessoa
    // qualquer -- que e o oposto do que a divisao "famosos" existe para fazer.
    for (const candidate of reais) {
      expect(DECLARED_PORTRAITS, candidate.name).toContain(candidate.id);
    }
  });

  it('desenha sempre o mesmo rosto para o mesmo nome', () => {
    // O retrato nao pode depender da semente da partida nem da ordem em que as
    // coisas foram sorteadas: e a mesma cara do primeiro ao ultimo mes.
    expect(portraitFor('min_qualquer', 'Fulano de Tal')).toEqual(
      portraitFor('min_qualquer', 'Fulano de Tal'),
    );
    expect(portraitFor('min_a', 'Fulano')).not.toEqual(portraitFor('min_b', 'Fulano'));
  });

  it('nao poe barba em quem o jogo trata como mulher', () => {
    const feminina = MINISTER_POOL.filter((candidate) => /a$/i.test(candidate.name.split(' ')[0]!));
    expect(feminina.length).toBeGreaterThan(0);

    for (const candidate of feminina) {
      if (candidate.origin === 'famoso') continue; // retrato declarado a mao
      expect(candidate.avatar.beard, candidate.name).toBe('nenhuma');
    }
  });

  it('varia o elenco ficticio em vez de repetir um rosto so', () => {
    const ficticios = MINISTER_POOL.filter((candidate) => candidate.origin !== 'famoso');
    const rostos = new Set(ficticios.map((candidate) => JSON.stringify(candidate.avatar)));

    // Um banco de nomes com dezenove pessoas nao pode ter cinco caras.
    expect(rostos.size).toBeGreaterThan(ficticios.length * 0.7);
  });
});
