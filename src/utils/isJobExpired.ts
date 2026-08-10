export function isJobExpired(deadline: string): boolean {
  const deadlineEndOfDay = new Date(`${deadline}T23:59:59`)
  return deadlineEndOfDay.getTime() < Date.now()
}
