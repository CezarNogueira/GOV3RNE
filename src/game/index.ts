/**
 * GOV3RNE - núcleo compartilhado.
 *
 * Tudo o que o backend e o frontend precisam saber sobre o jogo mora aqui:
 * tipos, dados iniciais, validações e os motores de simulação. Nenhum destes
 * módulos faz I/O, então o mesmo código roda no servidor e no navegador.
 */
export * from './types/index';
export * from './utils/index';
export * from './data/index';
export * from './schemas/index';
export * from './engines/index';
