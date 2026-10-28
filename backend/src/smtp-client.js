import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';

/**
 * Cliente SMTP mínimo (sin dependencias) para enviar correos reales, por ejemplo con
 * Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=tu@gmail.com y
 * SMTP_PASS=<contraseña de aplicación de 16 letras>. Soporta TLS directo (465) y
 * STARTTLS (587).
 */
export async function sendSmtpMail({ host, port = 465, user, pass, from, to, subject, text, timeout = 15000, rejectUnauthorized = true }) {
  const implicitTls = Number(port) === 465;
  let socket = implicitTls
    ? tls.connect({ host, port, servername: host, rejectUnauthorized })
    : net.connect({ host, port });
  socket.setTimeout(timeout);

  let buffer = '';
  let waiting = null;
  let failing = null;
  const fail = error => {
    const reject = failing;
    waiting = null;
    failing = null;
    reject?.(error);
  };
  const tryResolve = () => {
    // Una respuesta SMTP termina en una línea "NNN texto" (sin guion después del código).
    const lines = buffer.split('\r\n');
    const last = lines.length >= 2 ? lines[lines.length - 2] : '';
    if (/^\d{3} /.test(last) && waiting) {
      const response = buffer;
      buffer = '';
      const resolve = waiting;
      waiting = null;
      failing = null;
      resolve(response);
    }
  };
  const onData = chunk => {
    buffer += chunk.toString('utf8');
    tryResolve();
  };
  const attach = target => {
    target.on('data', onData);
    target.on('timeout', () => target.destroy(new Error('Tiempo de espera agotado con el servidor SMTP')));
    target.on('error', fail);
    target.on('close', () => fail(new Error('El servidor SMTP cerró la conexión')));
  };
  attach(socket);

  const read = () => new Promise((resolve, reject) => {
    waiting = resolve;
    failing = reject;
    tryResolve(); // la respuesta pudo llegar antes de empezar a esperarla
  });
  const expect = async (command, codes) => {
    if (command !== null) socket.write(`${command}\r\n`);
    const response = await read();
    const code = Number(response.slice(0, 3));
    if (!codes.includes(code)) throw new Error(`SMTP respondió ${response.trim().split('\r\n').pop()}`);
    return response;
  };

  try {
    await expect(null, [220]);
    const hostname = os.hostname() || 'detritus.local';
    let capabilities = await expect(`EHLO ${hostname}`, [250]);
    if (!implicitTls && /STARTTLS/i.test(capabilities)) {
      await expect('STARTTLS', [220]);
      socket.removeAllListeners('data');
      socket.removeAllListeners('close');
      socket.removeAllListeners('error');
      socket.on('error', () => {}); // los errores se reportan por la conexión TLS
      socket = tls.connect({ socket, servername: host, rejectUnauthorized });
      attach(socket);
      await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
      capabilities = await expect(`EHLO ${hostname}`, [250]);
    }
    if (user) {
      await expect('AUTH LOGIN', [334]);
      await expect(Buffer.from(user).toString('base64'), [334]);
      await expect(Buffer.from(pass || '').toString('base64'), [235]);
    }
    await expect(`MAIL FROM:<${from}>`, [250]);
    await expect(`RCPT TO:<${to}>`, [250, 251]);
    await expect('DATA', [354]);
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const body = Buffer.from(text, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');
    const message = [
      `From: Detritus Salud EPS <${from}>`,
      `To: <${to}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@detritus-salud>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      body,
      '.',
    ].join('\r\n');
    const accepted = await expect(message, [250]);
    socket.write('QUIT\r\n');
    socket.end();
    return { accepted: true, response: accepted.trim() };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}
