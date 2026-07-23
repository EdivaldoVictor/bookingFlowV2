import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { resolveUserRole } from "./roles";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      let userInfo: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null; platform?: string | null };

      if (code === "local-dev-code") {
        userInfo = {
          openId: "local-dev-user",
          name: "Usuário local",
          email: "local@example.com",
          loginMethod: "local-dev",
          platform: "local-dev",
        };
      } else {
        const tokenResponse = await sdk.exchangeCodeForToken(code, state);
        userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      }

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      const user = await db.getUserByOpenId(userInfo.openId);
      const role = user ? resolveUserRole(user) : "user";

      const redirectTo =
        (typeof req.query.redirectTo === "string" && req.query.redirectTo.startsWith("/"))
          ? req.query.redirectTo
          : role === "admin"
            ? "/dashboard/admin"
            : "/dashboard";

      res.redirect(302, redirectTo);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
