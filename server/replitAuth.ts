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
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days (1 month)
  const pgStore = connectPg(session);
  
  // Create resilient session store with timeout handling
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
    errorLog: (error: any) => {
      console.error('🔐 Session store error:', error.message);
    }
  });

  // Wrap session store methods to handle database suspensions
  const originalGet = sessionStore.get.bind(sessionStore);
  const originalSet = sessionStore.set.bind(sessionStore);
  const originalDestroy = sessionStore.destroy.bind(sessionStore);

  sessionStore.get = function(sid: string, callback: any) {
    let timeoutHit = false;
    const timeout = setTimeout(() => {
      timeoutHit = true;
      console.log('🔐 Session get timeout - database may be suspended, retrying once...');
      
      // Retry once with shorter timeout
      const retryTimeout = setTimeout(() => {
        console.log('🔐 Session get retry timeout, continuing with empty session');
        callback(null, null);
      }, 2000);
      
      originalGet(sid, (retryErr: any, retrySession: any) => {
        clearTimeout(retryTimeout);
        if (retryErr && (retryErr.code === '57P01' || retryErr.message?.includes('admin shutdown'))) {
          console.log('🔐 Session get retry failed - database suspended, using empty session');
          callback(null, null);
        } else {
          console.log('🔐 Session get retry succeeded');
          callback(retryErr, retrySession);
        }
      });
    }, 5000); // Allow more time for database wake-up

    originalGet(sid, (err: any, session: any) => {
      if (timeoutHit) return; // Don't process if timeout already handled it
      clearTimeout(timeout);
      
      if (err && (err.code === '57P01' || err.message?.includes('admin shutdown'))) {
        console.log('🔐 Session get database suspended, retrying...');
        // Retry once immediately
        setTimeout(() => {
          originalGet(sid, (retryErr: any, retrySession: any) => {
            if (retryErr && (retryErr.code === '57P01' || retryErr.message?.includes('admin shutdown'))) {
              console.log('🔐 Session get retry failed, using empty session');
              callback(null, null);
            } else {
              console.log('🔐 Session get retry succeeded after suspension');
              callback(retryErr, retrySession);
            }
          });
        }, 1000);
      } else {
        callback(err, session);
      }
    });
  };

  sessionStore.set = function(sid: string, session: any, callback: any) {
    const timeout = setTimeout(() => {
      console.log('🔐 Session set timeout, continuing anyway');
      callback && callback();
    }, 8000); // Increased timeout

    originalSet(sid, session, (err: any) => {
      clearTimeout(timeout);
      if (err && (err.code === '57P01' || err.message?.includes('admin shutdown'))) {
        console.log('🔐 Session set database suspended, retrying once...');
        // Retry set operation
        setTimeout(() => {
          originalSet(sid, session, (retryErr: any) => {
            if (retryErr && (retryErr.code === '57P01' || retryErr.message?.includes('admin shutdown'))) {
              console.log('🔐 Session set retry failed, continuing anyway');
            } else {
              console.log('🔐 Session set retry succeeded');
            }
            callback && callback(); // Always succeed to prevent auth failure
          });
        }, 1500);
      } else {
        callback && callback(err);
      }
    });
  };

  sessionStore.destroy = function(sid: string, callback: any) {
    const timeout = setTimeout(() => {
      console.log('🔐 Session destroy timeout, continuing anyway');
      callback && callback();
    }, 5000);

    originalDestroy(sid, (err: any) => {
      clearTimeout(timeout);
      if (err && (err.code === '57P01' || err.message?.includes('admin shutdown'))) {
        console.log('🔐 Session destroy database suspended, continuing anyway');
        callback && callback();
      } else {
        callback && callback(err);
      }
    });
  };

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: true, // Changed to true to force session saves during auth
    saveUninitialized: false,
    rolling: true, // Extend session on each request
    cookie: {
      httpOnly: true,
      secure: false, // Allow cookies to work in both development and production
      maxAge: sessionTtl,
      sameSite: 'lax',
      domain: undefined, // Let browser determine domain
      path: '/', // Ensure cookie applies to entire app
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
  try {
    await storage.upsertUser({
      id: claims["sub"],
      email: claims["email"],
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
    });
    console.log('🔐 User upserted successfully during auth');
  } catch (error: any) {
    if (error.code === '57P01' || error.message?.includes('admin shutdown')) {
      console.log('💤 Database suspended during user upsert, retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        await storage.upsertUser({
          id: claims["sub"],
          email: claims["email"],
          firstName: claims["first_name"],
          lastName: claims["last_name"],
          profileImageUrl: claims["profile_image_url"],
        });
        console.log('🔐 User upsert retry succeeded');
      } catch (retryError: any) {
        console.log('🔐 User upsert retry failed, continuing auth anyway:', retryError.message);
        // Continue authentication even if user upsert fails - session will still work
      }
    } else {
      console.error('🔐 User upsert error:', error.message);
      // Continue authentication even if user upsert fails - session will still work
    }
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      console.log('🔑 Auth verify starting for user:', tokens.claims()?.sub);
      const user = {};
      updateUserSession(user, tokens);
      console.log('🔑 User session updated:', Object.keys(user).join(', '));
      
      await upsertUser(tokens.claims());
      console.log('🔑 User upsert completed');
      
      verified(null, user);
      console.log('🔑 Auth verify completed successfully');
    } catch (error) {
      console.error('🔑 Auth verify error:', error);
      verified(error, null);
    }
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

  passport.serializeUser((user: Express.User, cb) => {
    console.log('🔑 Serializing user:', Object.keys(user || {}).join(', '));
    cb(null, user);
  });
  
  passport.deserializeUser((user: Express.User, cb) => {
    console.log('🔑 Deserializing user:', Object.keys(user || {}).join(', '));
    cb(null, user);
  });

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log("🔑 Auth callback received for domain:", req.hostname);
    console.log("🔑 Session ID before auth:", req.sessionID?.substring(0, 8) + "...");
    console.log("🔑 Query params:", Object.keys(req.query).join(", "));
    
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, (err) => {
      if (err) {
        console.error("🔑 Auth callback error:", err);
        return next(err);
      }
      console.log("🔑 Auth callback success - session ID after:", req.sessionID?.substring(0, 8) + "...");
      console.log("🔑 Auth callback success - user exists:", !!req.user);
      console.log("🔑 Auth callback success - isAuthenticated:", req.isAuthenticated ? req.isAuthenticated() : "method missing");
    });
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
    console.log("🔐 Auth check for:", req.method, req.path);
    console.log("🔐 isAuthenticated():", req.isAuthenticated ? req.isAuthenticated() : "method missing");
    console.log("🔐 req.user exists:", !!req.user);
    console.log("🔐 session ID:", req.sessionID ? req.sessionID.substring(0, 8) + "..." : "no session");
    console.log("🔐 session data keys:", req.session ? Object.keys(req.session).join(", ") : "no session");
    console.log("🔐 passport in session:", !!(req.session as any)?.passport);
    console.log("🔐 cookies count:", Object.keys(req.cookies || {}).length);
    
    const user = req.user as any;

    if (!req.isAuthenticated || !req.isAuthenticated()) {
      console.log("🔐 Auth failed - not authenticated - redirecting to login");
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!user || !user.expires_at) {
      console.log("🔐 Auth failed - no user or expires_at - user:", !!user, "expires_at:", user?.expires_at);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = user.expires_at - now;
    console.log("🔐 Auth check - time until expiry:", timeUntilExpiry, "seconds");
    
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
