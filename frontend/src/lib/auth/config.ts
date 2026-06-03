import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider   from "next-auth/providers/google";
import GitHubProvider   from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users as any, 
    accountsTable: accounts as any,
    sessionsTable: sessions as any,
    verificationTokensTable: verificationTokens as any,
  }),

  providers: [
    // ── Email + Password ─────────────────────────────────────────────────────
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email.toLowerCase()),
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),

    // ── OAuth ────────────────────────────────────────────────────────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
    GitHubProvider({
      clientId:     process.env.GITHUB_CLIENT_ID     ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Fetch latest username from DB
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { username: true },
        });
        token.username = dbUser?.username ?? user.email?.split("@")[0] ?? "racer";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id       = token.id       as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },

  events: {
    async createUser({ user }) {
      if (user.id && user.email) {
        const base     = user.email.split("@")[0].replace(/[^a-z0-9_]/gi, "_").toLowerCase();
        const username = `${base}_${Math.floor(Math.random() * 9000 + 1000)}`;
        await db.update(users).set({ username }).where(eq(users.id, user.id));
      }
    },
  },

  pages: {
    signIn: "/auth/signin",
    error:  "/auth/error",
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug:  process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);
