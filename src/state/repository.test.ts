import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR, GAME_STATE_VERSION } from '@/game';
import { repository } from './repository';

const president = { firstName: 'Ana', lastName: 'Souza', politicalName: 'Ana Souza', avatar: DEFAULT_AVATAR };

beforeEach(() => localStorage.clear());

describe('repositório de saves', () => {
  it('cria, lista e recarrega uma partida idêntica', () => {
    const created = repository.create({ president, seed: 5 });
    expect(repository.list()).toHaveLength(1);
    expect(repository.list()[0]).toMatchObject({ id: created.id, gdpRank: 10, month: 1, defeated: false });
    expect(repository.load(created.id)).toEqual(created);
  });

  it('grava a escolha na hora: recarregar não permite escolher de novo nem sortear outra rolagem', () => {
    const { id, turn } = repository.create({ president, seed: 9 });
    const { resolution } = repository.choose(id, turn.offeredCardIds[0]!);
    const reloaded = repository.load(id);
    expect(reloaded.turn.choice).toEqual(resolution);
    expect(() => repository.choose(id, turn.offeredCardIds[1]!)).toThrow(/já escolheu/);
  });

  it('avançar o mês exige carta escolhida e persiste o novo mês', () => {
    const { id, turn } = repository.create({ president, seed: 3 });
    expect(() => repository.advance(id)).toThrow(/Escolha uma das três cartas/);
    repository.choose(id, turn.offeredCardIds[0]!);
    const { state, report } = repository.advance(id);
    expect(report.month).toBe(1);
    expect(repository.load(id).month).toBe(2);
    expect(repository.load(id).history).toHaveLength(1);
    expect(state.turn.choice).toBeNull();
  });

  it('exporta e importa o mesmo mandato', () => {
    const created = repository.create({ president, seed: 1 });
    const raw = repository.exportSave(created.id);
    repository.remove(created.id);
    expect(repository.list()).toHaveLength(0);
    expect(repository.importSave(raw).id).toBe(created.id);
    expect(repository.list()).toHaveLength(1);
  });

  it('recusa save de outra versão, lixo e JSON de outra coisa, sem tocar nos existentes', () => {
    const created = repository.create({ president, seed: 1 });
    const old = JSON.stringify({ ...created, version: GAME_STATE_VERSION - 1 });
    expect(() => repository.importSave(old)).toThrow(/outra versão/);
    expect(() => repository.importSave('não é json')).toThrow(/corrompido/);
    expect(() => repository.importSave('{"foo":1}')).toThrow(/não parece ser um save/);
    expect(repository.list()).toHaveLength(1);
  });

  it('saves do simulador antigo ficam intactos, em outro namespace', () => {
    localStorage.setItem('gov3rne.saves', '["legado"]');
    repository.create({ president, seed: 1 });
    expect(localStorage.getItem('gov3rne.saves')).toBe('["legado"]');
    expect(repository.list()).toHaveLength(1);
  });

  it('apagar remove o save e a entrada do índice', () => {
    const { id } = repository.create({ president, seed: 1 });
    repository.remove(id);
    expect(repository.list()).toHaveLength(0);
    expect(() => repository.load(id)).toThrow(/não foi encontrado/);
  });

  it('limpar o armazenamento do navegador apaga os saves de verdade', () => {
    repository.create({ president, seed: 1 });
    localStorage.clear();
    expect(repository.list()).toHaveLength(0);
  });
});

describe('armazenamento bloqueado', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a partida segue em memória quando o navegador recusa a gravação', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const created = repository.create({ president, seed: 2 });
    expect(repository.load(created.id).id).toBe(created.id);
    const { turn } = created;
    const chosen = repository.choose(created.id, turn.offeredCardIds[0]!);
    expect(repository.load(created.id).turn.choice).toEqual(chosen.resolution);
    repository.remove(created.id);
    expect(() => repository.load(created.id)).toThrow(/não foi encontrado/);
  });
});
