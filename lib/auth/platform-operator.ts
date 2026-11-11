const DEFAULT_PLATFORM_OPERATORS = ["infotaxlyn@gmail.com"]

export function platformOperatorEmails(): Set<string> {
  const configured = process.env.PLATFORM_OPERATOR_EMAILS ?? ""
  return new Set(
    [...DEFAULT_PLATFORM_OPERATORS, ...configured.split(",")]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isPlatformOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return platformOperatorEmails().has(email.trim().toLowerCase())
}

export function userIsPlatformOperator(user: {
  email: string
  isPlatformOperator?: boolean | null
}): boolean {
  return Boolean(user.isPlatformOperator) || isPlatformOperatorEmail(user.email)
}
