import { handlers } from "@/auth";

export const runtime = "nodejs";

const getHandler = handlers.GET as (request: Request) => Promise<Response>;
const postHandler = handlers.POST as (request: Request) => Promise<Response>;

export function GET(request: Request) {
  return getHandler(request);
}

export function POST(request: Request) {
  return postHandler(request);
}
