function databaseNameFromUrl(databaseUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('Integration tests require DATABASE_URL to be a valid PostgreSQL URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('Integration tests require DATABASE_URL to use PostgreSQL.');
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  if (!databaseName) {
    throw new Error('Integration tests require DATABASE_URL to include a database name.');
  }

  return databaseName;
}

export default function guardIntegrationDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'Integration tests require DATABASE_URL for a dedicated test database.',
    );
  }

  const databaseName = databaseNameFromUrl(databaseUrl);
  if (!/(^|[-_])test($|[-_])/.test(databaseName.toLowerCase())) {
    throw new Error(
      `Refusing to run integration tests against non-test database "${databaseName}".`,
    );
  }
}
