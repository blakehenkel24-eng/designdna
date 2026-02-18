import { NextRequest } from "next/server";

import { POST as analyzePost } from "@/app/api/analyze/route";

export async function POST(request: NextRequest) {
  return analyzePost(request);
}
