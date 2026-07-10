import { describe, expect, it } from 'vitest';
import { formatPostgresSchemaDocument } from './postgresSchemaDocument.js';

describe('formatPostgresSchemaDocument', () => {
  it('keeps schema metadata while removing PostgreSQL COPY data', () => {
    const dump = [
      'CREATE TABLE public.providers (',
      '  id uuid NOT NULL',
      ');',
      'CREATE TABLE public.bookings (',
      '  id uuid NOT NULL,',
      '  customer_id uuid NOT NULL,',
      '  provider_id uuid NOT NULL',
      ');',
      "COMMENT ON TABLE public.bookings IS 'Booking records';",
      'COPY public.bookings (id, customer_id) FROM stdin;',
      'secret-id\tsecret-customer',
      '\\.',
      'ALTER TABLE ONLY public.bookings',
      '  ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);',
      'ALTER TABLE ONLY public.bookings',
      '  ADD CONSTRAINT bookings_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE;',
      'CREATE INDEX ix_bookings_customer_id ON public.bookings USING btree (customer_id);',
    ].join('\n');

    const document = formatPostgresSchemaDocument(dump);

    expect(document).toContain('## public.bookings');
    expect(document).toContain('bookings_pkey');
    expect(document).toContain('ix_bookings_customer_id');
    expect(document).toContain('Direct reference: provider_id -> public.providers(id) via bookings_provider_id_fkey');
    expect(document).toContain('Referenced directly by: public.bookings(provider_id) via bookings_provider_id_fkey');
    expect(document).not.toContain('secret-customer');
  });
});
