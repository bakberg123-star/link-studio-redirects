module.exports = function handler(request, response) {
  const { target, code } = request.query;
  if (typeof target !== 'string' || typeof code !== 'string' ||
      !/^[A-Za-z0-9_-]{12,3000}$/.test(target) ||
      !/^[a-z0-9-]{2,64}$/.test(code)) {
    response.status(400).send('Invalid link');
    return;
  }

  try {
    const decoded = Buffer.from(target, 'base64url').toString('utf8');
    if (Buffer.from(decoded, 'utf8').toString('base64url') !== target) throw new Error('Invalid encoding');
    const destination = new URL(decoded);
    const currentHost = request.headers.host?.split(':')[0]?.toLowerCase();
    if (destination.protocol !== 'https:' || destination.username || destination.password ||
        decoded.length > 2048 || destination.hostname.toLowerCase() === currentHost) {
      throw new Error('Invalid destination');
    }
    response.setHeader('Cache-Control', 'no-store');
    response.writeHead(307, { Location: destination.href });
    response.end();
  } catch {
    response.status(400).send('Invalid link');
  }
};
