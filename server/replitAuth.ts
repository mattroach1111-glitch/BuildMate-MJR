import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: true, // Changed to true for OAuth flow
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      maxAge: sessionTtl,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-site cookies in production
      domain: process.env.NODE_ENV === 'production' ? '.replit.app' : undefined, // Set domain for replit.app
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  // Add CORS headers for authentication in production
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
      next();
    });
  }
  
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Use the first configured domain for authentication
    const domain = process.env.REPLIT_DOMAINS!.split(",")[0];
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log("🔐🔐🔐 CALLBACK ROUTE HIT! 🔐🔐🔐");
    console.log("🔐 Callback received - query params:", req.query);
    console.log("🔐 Callback received - hostname:", req.hostname);
    console.log("🔐 Callback received - full URL:", req.url);
    console.log("🔐 Session ID:", req.sessionID);
    
    // Use the first configured domain for authentication
    const domain = process.env.REPLIT_DOMAINS!.split(",")[0];
    console.log("🔐 Using domain for callback:", domain);
    
    passport.authenticate(`replitauth:${domain}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error("🔐 Callback authentication error:", err);
        return res.redirect("/api/login");
      }
      
      if (!user) {
        console.error("🔐 Callback authentication failed - no user:", info);
        return res.redirect("/api/login");
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error("🔐 Login error:", err);
          return res.redirect("/api/login");
        }
        
        console.log("🔐 Callback authentication successful, redirecting to /");
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    console.log("🔐 Auth check - isAuthenticated():", req.isAuthenticated ? req.isAuthenticated() : "method missing");
    console.log("🔐 Auth check - req.user exists:", !!req.user);
    
    const user = req.user as any;

    if (!req.isAuthenticated || !req.isAuthenticated()) {
      console.log("🔐 Auth failed - not authenticated");
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!user || !user.expires_at) {
      console.log("🔐 Auth failed - no user or expires_at");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= user.expires_at) {
      console.log("🔐 Auth success - token valid");
      return next();
    }

    console.log("🔐 Auth - token expired, attempting refresh");
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      console.log("🔐 Auth failed - no refresh token");
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
      console.log("🔐 Auth success - token refreshed");
      return next();
    } catch (error) {
      console.log("🔐 Auth failed - refresh error:", error);
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  } catch (error) {
    console.error("🔐 Auth middleware error:", error);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
