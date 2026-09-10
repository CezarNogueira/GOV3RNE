import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from './overlays';

/**
 * A TRAVA DE ROLAGEM DEPOIS QUE O MODAL FECHA
 *
 * O modal trava a rolagem do fundo enquanto esta aberto, e isso mexe num
 * recurso global. O bug que estes testes guardam: sair do modal e a pagina
 * continuar travada, exigindo F5 -- que foi o que acontecia ao abrir a
 * audiencia com a empresa ou a venda dela, porque a ficha da empresa abre um
 * modal e, de DENTRO dele, abre outro.
 */
function UmModal() {
  const [aberto, setAberto] = useState(true);
  return (
    <Modal open={aberto} onClose={() => setAberto(false)} title="Ficha">
      <button type="button" onClick={() => setAberto(false)}>
        fechar
      </button>
    </Modal>
  );
}

/** A ficha da empresa com a audiencia por cima: dois modais ao mesmo tempo. */
function DoisModais() {
  const [ficha, setFicha] = useState(true);
  const [audiencia, setAudiencia] = useState(false);

  return (
    <>
      <Modal open={ficha} onClose={() => setFicha(false)} title="Empresa">
        <button type="button" onClick={() => setAudiencia(true)}>
          abrir audiencia
        </button>
        <button type="button" onClick={() => setFicha(false)}>
          fechar ficha
        </button>
      </Modal>
      <Modal open={audiencia} onClose={() => setAudiencia(false)} title="Audiencia">
        <button type="button" onClick={() => setAudiencia(false)}>
          fechar audiencia
        </button>
      </Modal>
    </>
  );
}

describe('rolagem da pagina', () => {
  it('trava enquanto o modal esta aberto', () => {
    render(<UmModal />);
    expect(document.body.style.overflow).toBe('hidden');
    cleanup();
  });

  it('destrava quando o modal fecha', () => {
    render(<UmModal />);
    fireEvent.click(screen.getByText('fechar'));

    expect(document.body.style.overflow).not.toBe('hidden');
    cleanup();
  });

  it('destrava depois de abrir e fechar um modal DENTRO de outro', () => {
    render(<DoisModais />);

    fireEvent.click(screen.getByText('abrir audiencia'));
    expect(document.body.style.overflow).toBe('hidden');

    // Fecha a de dentro: a ficha continua aberta, entao a pagina segue travada.
    fireEvent.click(screen.getByText('fechar audiencia'));
    expect(document.body.style.overflow).toBe('hidden');

    // Fecha a de fora: agora sim a pagina volta a rolar.
    fireEvent.click(screen.getByText('fechar ficha'));
    expect(document.body.style.overflow).not.toBe('hidden');
    cleanup();
  });

  it('destrava mesmo quando o modal de dentro fecha depois do de fora', () => {
    render(<DoisModais />);
    fireEvent.click(screen.getByText('abrir audiencia'));

    fireEvent.click(screen.getByText('fechar ficha'));
    fireEvent.click(screen.getByText('fechar audiencia'));

    expect(document.body.style.overflow).not.toBe('hidden');
    cleanup();
  });

  it('sobrevive a re-render do pai com onClose novo a cada vez', () => {
    // A ficha da empresa passa `() => setX(false)`: funcao nova a cada render.
    // Era isso que remontava o efeito e fazia ele guardar o proprio `hidden`
    // como "valor anterior".
    function ComRerender() {
      const [contador, setContador] = useState(0);
      const [aberto, setAberto] = useState(true);
      return (
        <Modal open={aberto} onClose={() => setAberto(false)} title={`Ficha ${contador}`}>
          <button type="button" onClick={() => setContador((atual) => atual + 1)}>
            redesenhar
          </button>
          <button type="button" onClick={() => setAberto(false)}>
            fechar
          </button>
        </Modal>
      );
    }

    render(<ComRerender />);
    for (let vez = 0; vez < 5; vez += 1) fireEvent.click(screen.getByText('redesenhar'));

    fireEvent.click(screen.getByText('fechar'));
    expect(document.body.style.overflow).not.toBe('hidden');
    cleanup();
  });
});
