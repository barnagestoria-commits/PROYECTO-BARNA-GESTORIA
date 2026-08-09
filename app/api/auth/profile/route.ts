import { NextResponse } from "next/server"
import { authErrorResponse } from "@/lib/auth/api-auth"
import { updateUserProfile } from "@/lib/auth/service"
import type { UpdateUserProfileRequest } from "@/lib/types/auth"

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as UpdateUserProfileRequest
    const session = await updateUserProfile(body)
    return NextResponse.json({ success: true, session })
  } catch (error) {
    return authErrorResponse(error)
  }
}
