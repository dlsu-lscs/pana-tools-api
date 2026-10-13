import { defineRelations } from 'drizzle-orm';
import { application, user, rating, userFavorite, session, account } from './schema.js';

export const relations = defineRelations(
  {
    application,
    rating,
    userFavorite,
    user,
    session,
    account,
  },
  (r) => ({
    application: {
      user: r.one.user({
        from: r.application.userId,
        to: r.user.id,
      }),
      rating: r.many.rating(),
      userFavorite: r.many.userFavorite(),
    },
    rating: {
      user: r.one.user({
        from: r.rating.userId,
        to: r.user.id,
      }),
      application: r.one.application({
        from: r.rating.applicationId,
        to: r.application.id,
      }),
    },
    userFavorite: {
      user: r.one.user({
        from: r.userFavorite.userId,
        to: r.user.id,
      }),
      application: r.one.application({
        from: r.userFavorite.applicationId,
        to: r.application.id,
      }),
    },
    user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      applications: r.many.application(),
      rating: r.many.rating(),
      userFavorite: r.many.userFavorite(),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
  }),
);
