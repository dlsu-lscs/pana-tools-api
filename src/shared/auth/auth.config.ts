import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/shared/config/database.js';
import * as schema from '@/shared/infrastructure/database/schema.js';
import { openAPI, admin } from 'better-auth/plugins';

const isProd = process.env.NODE_ENV === 'production';
const plugins = (isProd ? [admin()] : [openAPI(), admin()]) satisfies NonNullable<
  Parameters<typeof betterAuth>[0]['plugins']
>;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  schema: {
    user: {
      additionalFields: {
        website: {
          type: 'string',
          input: true,
          required: false,
        },
        logo: {
          type: 'string',
          input: true,
          required: false,
        },
        tosAccepted: {
          type: 'boolean',
          input: false,
          required: false,
        },
        tosAcceptedAt: {
          type: 'date',
          input: false,
          required: false,
        },
      },
    },
  },
  baseURL: process.env.BETTER_AUTH_URL, //http://localhost:8000 if developing locally
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') || ['http://localhost:3000'],
  plugins,
});


export type Session = typeof auth.$Infer.Session