import type { AuthUser } from '../types/user'

export function calculateProfileCompletion(user: AuthUser | null): number {
  if (!user || user.role !== 'candidate') return 0

  const profile = user.candidateProfile
  const checks = [
    user.fullName,
    user.phone,
    profile?.headline,
    profile?.address,
    profile?.bio,
    profile?.skills.length,
    profile?.experiences.length,
    profile?.educations.length,
    profile?.cvUrl,
  ]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
