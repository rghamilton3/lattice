import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { existsSync } from "node:fs";
import type { Database } from "bun:sqlite";
import { authentikBeforeHandle, agentBeforeHandle } from "./guards";
import { capturesRoutes } from "./routes/captures";
import { searchRoutes } from "./routes/search";
import { filesRoutes } from "./routes/files";
import { workingRoutes } from "./routes/working";
import { lateralRoutes } from "./routes/lateral";
import { agentRoutes } from "./routes/agent";

export interface AppDeps {
  db: Database;
  agentToken: string | undefined;
  allowHttp: boolean;
  devUser: string | undefined;
  surfaceBuild: string | undefined;
  attachmentsDir: string;
}

export function buildApp(deps: AppDeps) {
  const { db, agentToken, allowHttp, devUser, surfaceBuild, attachmentsDir } = deps;

  const surface =
    surfaceBuild && existsSync(surfaceBuild)
      ? staticPlugin({ assets: surfaceBuild, prefix: "", indexHTML: true, alwaysStatic: false })
      : new Elysia();

  return new Elysia()
    .get("/ping", () => ({ ok: true }))
    .use(surface)
    .guard(
      { beforeHandle: authentikBeforeHandle({ allowHttp, devUser }) },
      (app) =>
        app
          .use(capturesRoutes(db))
          .use(searchRoutes())
          .use(filesRoutes(db))
          .use(workingRoutes(db))
          .use(lateralRoutes(db))
    )
    .group("/api/agent", (app) =>
      app.guard(
        { beforeHandle: agentBeforeHandle({ allowHttp, agentToken }) },
        (inner) => inner.use(agentRoutes(db, { attachmentsDir }))
      )
    );
}
