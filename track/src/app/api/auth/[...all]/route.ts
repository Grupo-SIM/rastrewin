import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { isAdminApiPath } from "@/lib/auth-admin-paths";

// /api/auth/admin/* nunca chega ao Better Auth (2ª barreira, além de disabledPaths).
export const { GET, POST } = toNextJsHandler(async (request: Request) =>
	isAdminApiPath(request.url) ? new Response("Not Found", { status: 404 }) : getAuth().handler(request),
);
