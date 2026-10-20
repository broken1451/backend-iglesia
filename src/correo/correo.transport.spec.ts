import { ConfigService } from '@nestjs/config';
import { FileMailTransport, LogMailTransport, SmtpTransport } from '@nestjs/mail';
import type { MailMessage, MailTransport, MailTransportSendOptions } from '@nestjs/mail';
import { crearTransporte, EnvioConCopia } from './correo.transport.js';

/** ConfigService falso: devuelve los valores de un objeto plano por su clave ("email.host"). */
const config = (valores: Record<string, unknown>) => ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

describe('crearTransporte', () => {
  it('usa "file" por defecto', () => {
    expect(crearTransporte(config({}))).toBeInstanceOf(FileMailTransport);
  });

  it('crea el transporte "log"', () => {
    expect(crearTransporte(config({ 'email.transport': 'log' }))).toBeInstanceOf(LogMailTransport);
  });

  it('crea el transporte "smtp" con host', () => {
    const transporte = crearTransporte(config({ 'email.transport': 'smtp', 'email.host': 'smtp.example.com', 'email.port': '587' }));
    expect(transporte).toBeInstanceOf(SmtpTransport);
  });

  it('con guardarCopia, "smtp" envía y además guarda el .eml', () => {
    const transporte = crearTransporte(config({ 'email.transport': 'smtp', 'email.host': 'smtp.example.com', 'email.guardarCopia': true }));
    expect(transporte).toBeInstanceOf(EnvioConCopia);
  });

  it('rechaza "smtp" sin host al arrancar', () => {
    expect(() => crearTransporte(config({ 'email.transport': 'smtp' }))).toThrow('falta email.host');
  });

  it('rechaza un transporte que no existe', () => {
    expect(() => crearTransporte(config({ 'email.transport': 'gmail' }))).toThrow('Opciones: file, log, smtp');
  });
});

describe('EnvioConCopia', () => {
  const mensaje = {} as MailMessage;
  const opciones = { attempt: 1 } as MailTransportSendOptions;
  /** Transporte falso: send() resuelve con `resultado` o, si es un Error, lo rechaza. */
  const transporte = (resultado: object) =>
    ({ send: vi.fn(() => (resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado))), close: vi.fn() }) as unknown as MailTransport & {
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };

  it('envía y luego guarda la copia, devolviendo el resultado del envío', async () => {
    const envio = transporte({ response: '250 OK' });
    const copia = transporte({ response: 'mails/x.eml' });
    await expect(new EnvioConCopia(envio, copia).send(mensaje, opciones)).resolves.toEqual({ response: '250 OK' });
    expect(copia.send).toHaveBeenCalledWith(mensaje, opciones);
  });

  it('si el envío falla, no guarda copia y deja que el Mailer reintente', async () => {
    const copia = transporte({});
    await expect(new EnvioConCopia(transporte(new Error('535 Invalid login')), copia).send(mensaje, opciones)).rejects.toThrow('535');
    expect(copia.send).not.toHaveBeenCalled();
  });

  it('si falla solo la copia, el envío cuenta como exitoso', async () => {
    const envio = transporte({ response: '250 OK' });
    await expect(new EnvioConCopia(envio, transporte(new Error('EACCES'))).send(mensaje, opciones)).resolves.toEqual({ response: '250 OK' });
  });

  it('al apagar, cierra el transporte de envío', async () => {
    const envio = transporte({});
    await new EnvioConCopia(envio, transporte({})).close();
    expect(envio.close).toHaveBeenCalled();
  });
});
