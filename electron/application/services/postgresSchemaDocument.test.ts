import { describe, expect, it } from 'vitest';
import { formatPostgresSchemaDocument } from './postgresSchemaDocument.js';

describe('formatPostgresSchemaDocument', () => {
  it('keeps schema metadata while removing PostgreSQL COPY data', () => {
    const dump = [
      'CREATE TABLE public.bookings (',
      '  id uuid NOT NULL,',
      '  customer_id uuid NOT NULL',
      ');',
      "COMMENT ON TABLE public.bookings IS 'Booking records';",
      'COPY public.bookings (id, customer_id) FROM stdin;',
      'secret-id\tsecret-customer',
      '\\.',
      'ALTER TABLE ONLY public.bookings',
      '  ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);',
      'CREATE INDEX ix_bookings_customer_id ON public.bookings USING btree (customer_id);',
    ].join('\n');

    const document = formatPostgresSchemaDocument(dump);

    expect(document).toContain('## public.bookings');
    expect(document).toContain('bookings_pkey');
    expect(document).toContain('ix_bookings_customer_id');
    expect(document).not.toContain('secret-customer');
  });
});
