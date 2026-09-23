import http from 'node:http';

export function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function startService({ name, port, routes }) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const route = routes.find(item => item.method === req.method && item.path === url.pathname);
      if (!route) return json(res, 404, { service: name, error: 'Ruta no encontrada' });
      return route.handler(req, res, url);
    } catch (error) {
      return json(res, 500, { service: name, error: error.message });
    }
  });

  server.listen(port, () => console.log(`${name} escuchando en http://localhost:${port}`));
}
