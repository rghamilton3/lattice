import { timingSafeEqual } from "node:crypto";

export interface AuthentikGuardOptions {
  allowHttp: boolean;
  devUser: string | undefined;
}

export interface AgentGuardOptions {
  allowHttp: boolean;
  agentToken: string | undefined;
}

interface BeforeHandleCtx {
  headers: Record<string, string | undefined>;
  set: { status?: number | string };
}

function tokenMatches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function authentikBeforeHandle({ allowHttp, devUser }: AuthentikGuardOptions) {
  return ({ headers, set }: BeforeHandleCtx): string | undefined => {
    if (!allowHttp && headers["x-forwarded-proto"] !== "https") {
      set.status = 400;
      return "HTTPS required";
    }
    if (devUser) {
      headers["x-authentik-username"] = devUser;
    } else if (!headers["x-authentik-username"]) {
      set.status = 401;
      return "Unauthorized";
    }
    return undefined;
  };
}

export function agentBeforeHandle({ allowHttp, agentToken }: AgentGuardOptions) {
  return ({ headers, set }: BeforeHandleCtx): string | undefined => {
    if (!allowHttp && headers["x-forwarded-proto"] !== "https") {
      set.status = 400;
      return "HTTPS required";
    }
    const authHeader = headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!agentToken || !token || !tokenMatches(token, agentToken)) {
      set.status = 401;
      return "Unauthorized";
    }
    return undefined;
  };
}
