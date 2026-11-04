import { getNewsDigest } from "@/lib/news/service";

export async function GET() {
  return Response.json(await getNewsDigest());
}
