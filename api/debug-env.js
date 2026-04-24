// Temporary diagnostic — shows which env vars are present (true/false), never their values.
// Delete this file once OPENAI_API_KEY issue is resolved.
export default function handler(req, res) {
  const vars = [
    'DATABASE_URL', 'ADMIN_TOKEN', 'ADMIN_PASSWORD',
    'JWT_SECRET', 'SESSION_SECRET', 'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'SENDGRID_API_KEY', 'FROM_EMAIL', 'APP_URL',
    'NODE_ENV', 'VERCEL', 'VERCEL_ENV',
  ];
  const result = {};
  for (const v of vars) result[v] = !!process.env[v];
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(result);
}
