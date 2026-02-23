import { registerAs } from '@nestjs/config';

export default registerAs('ews', () => ({
  url: process.env.EWS_URL || '',
  tokenUrl: process.env.EWS_TOKEN_URL || '',
  clientId: process.env.EWS_CLIENT_ID || '',
  clientSecret: process.env.EWS_CLIENT_SECRET || '',
  scope: process.env.EWS_SCOPE || '',
  resource: process.env.EWS_RESOURCE || '',
  version: process.env.EWS_VERSION || 'Exchange2016',
  impersonate: process.env.EWS_IMPERSONATE === 'true',
  validateOnLogin: process.env.EWS_VALIDATE_ON_LOGIN === 'true',
  ssoEnabled: process.env.EWS_SSO_ENABLED !== 'false',
  tlsRejectUnauthorized: process.env.EWS_TLS_REJECT_UNAUTHORIZED !== 'false',
}));
