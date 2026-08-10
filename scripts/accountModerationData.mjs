const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const ACCOUNT_STATUSES = new Set(['active', 'locked'])
const MODERATION_STATUSES = new Set([
  'unsubmitted',
  'pending',
  'approved',
  'rejected',
  'hidden',
])

function validTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function referenceTime(db) {
  const timestamps = [Date.parse('2026-08-10T08:00:00.000Z')]
  for (const collectionName of ['users', 'jobs', 'applications', 'bookmarks', 'reviews', 'companyFollows', 'notifications']) {
    const collection = Array.isArray(db[collectionName]) ? db[collectionName] : []
    for (const item of collection) {
      for (const field of ['createdAt', 'updatedAt', 'appliedAt', 'readAt']) {
        if (validTimestamp(item[field])) timestamps.push(Date.parse(item[field]))
      }
    }
  }
  return Math.max(...timestamps) + DAY
}

function approvedModerationFields(job, admin, latestAllowedTime) {
  const createdTime = Date.parse(job.createdAt)
  const updatedTime = validTimestamp(job.updatedAt)
    ? Math.max(createdTime, Math.min(Date.parse(job.updatedAt), latestAllowedTime))
    : createdTime
  const adminCreatedTime = Date.parse(admin.createdAt)
  const moderationFloor = Math.max(createdTime, adminCreatedTime)

  let submittedTime = createdTime
  let moderatedTime = createdTime
  if (moderationFloor <= updatedTime && updatedTime > createdTime) {
    const submissionWindow = Math.floor((updatedTime - createdTime) * 0.4)
    submittedTime = createdTime + (
      submissionWindow > 0
        ? hashString(`submitted|${job.id}`) % (submissionWindow + 1)
        : 0
    )
    const earliestModerationTime = Math.max(submittedTime, moderationFloor)
    const moderationWindow = updatedTime - earliestModerationTime
    moderatedTime = earliestModerationTime + (
      moderationWindow > 0
        ? hashString(`moderated|${job.id}`) % (moderationWindow + 1)
        : 0
    )
  }

  return {
    moderationStatus: 'approved',
    moderationReason: null,
    submittedAt: new Date(submittedTime).toISOString(),
    moderatedAt: new Date(moderatedTime).toISOString(),
    moderatedBy: admin.id,
  }
}

export function addAccountModerationDefaults(db) {
  const admins = (db.users ?? [])
    .filter((user) => user.role === 'admin')
    .sort((first, second) => first.id.localeCompare(second.id))
  const admin = admins.find((user) => user.id === 'user_admin_01') ?? admins[0]
  const hasJobsRequiringApproval = (db.jobs ?? []).some((job) => job.status !== 'draft')
  if (hasJobsRequiringApproval && !admin) {
    throw new Error('Cần ít nhất một Admin để migration các Job đã duyệt.')
  }
  const latestAllowedTime = referenceTime(db)

  const users = (db.users ?? []).map((user) => ({
    ...user,
    accountStatus: hasOwn(user, 'accountStatus') ? user.accountStatus : 'active',
    lockedAt: hasOwn(user, 'lockedAt') ? user.lockedAt : null,
    lockedBy: hasOwn(user, 'lockedBy') ? user.lockedBy : null,
    lockReason: hasOwn(user, 'lockReason') ? user.lockReason : null,
  }))

  const jobs = (db.jobs ?? []).map((job) => {
    if (hasOwn(job, 'moderationStatus')) {
      return {
        ...job,
        moderationReason: hasOwn(job, 'moderationReason') ? job.moderationReason : null,
        submittedAt: hasOwn(job, 'submittedAt') ? job.submittedAt : null,
        moderatedAt: hasOwn(job, 'moderatedAt') ? job.moderatedAt : null,
        moderatedBy: hasOwn(job, 'moderatedBy') ? job.moderatedBy : null,
      }
    }

    if (job.status === 'draft') {
      return {
        ...job,
        moderationStatus: 'unsubmitted',
        moderationReason: null,
        submittedAt: null,
        moderatedAt: null,
        moderatedBy: null,
      }
    }

    return {
      ...job,
      ...approvedModerationFields(job, admin, latestAllowedTime),
    }
  })

  return { ...db, users, jobs }
}

export function validateAccountModerationData(db, { requireSeedDefaults = false } = {}) {
  const errors = []
  if (!Array.isArray(db.users)) errors.push('users phải là một mảng')
  if (!Array.isArray(db.jobs)) errors.push('jobs phải là một mảng')
  if (errors.length > 0) throw new Error(errors.join('\n'))

  const usersById = new Map(db.users.map((user) => [user.id, user]))
  for (const user of db.users) {
    if (!ACCOUNT_STATUSES.has(user.accountStatus)) {
      errors.push(`${user.id}: accountStatus không hợp lệ`)
      continue
    }
    if (user.accountStatus === 'active') {
      if (user.lockedAt !== null || user.lockedBy !== null || user.lockReason !== null) {
        errors.push(`${user.id}: tài khoản active phải có các trường khóa bằng null`)
      }
    } else {
      const actor = usersById.get(user.lockedBy)
      if (!validTimestamp(user.lockedAt) || user.lockedAt < user.createdAt) {
        errors.push(`${user.id}: lockedAt không hợp lệ`)
      }
      if (actor?.role !== 'admin') errors.push(`${user.id}: lockedBy không phải Admin`)
      if (!user.lockReason?.trim()) errors.push(`${user.id}: thiếu lý do khóa`)
    }
    if (requireSeedDefaults && user.accountStatus !== 'active') {
      errors.push(`${user.id}: tài khoản seed phải active`)
    }
  }

  for (const job of db.jobs) {
    if (!MODERATION_STATUSES.has(job.moderationStatus)) {
      errors.push(`${job.id}: moderationStatus không hợp lệ`)
      continue
    }
    const actor = usersById.get(job.moderatedBy)
    const submittedValid = validTimestamp(job.submittedAt) && job.submittedAt >= job.createdAt
    const moderatedValid = validTimestamp(job.moderatedAt) &&
      submittedValid && job.moderatedAt >= job.submittedAt
    const moderationWithinJobHistory =
      (!validTimestamp(job.submittedAt) || job.submittedAt <= job.updatedAt) &&
      (!validTimestamp(job.moderatedAt) || job.moderatedAt <= job.updatedAt)

    if (job.moderationStatus === 'unsubmitted') {
      if (
        job.submittedAt !== null || job.moderatedAt !== null ||
        job.moderatedBy !== null || job.moderationReason !== null
      ) {
        errors.push(`${job.id}: Job unsubmitted phải có metadata duyệt bằng null`)
      }
    } else if (job.moderationStatus === 'pending') {
      if (!submittedValid) errors.push(`${job.id}: submittedAt không hợp lệ`)
      if (job.moderatedAt !== null || job.moderatedBy !== null || job.moderationReason !== null) {
        errors.push(`${job.id}: Job pending chưa được có kết quả duyệt`)
      }
    } else {
      if (!submittedValid) errors.push(`${job.id}: submittedAt không hợp lệ`)
      if (!moderatedValid) errors.push(`${job.id}: moderatedAt không hợp lệ`)
      if (actor?.role !== 'admin') errors.push(`${job.id}: moderatedBy không phải Admin`)
      if (job.moderationStatus === 'approved') {
        if (job.moderationReason !== null) errors.push(`${job.id}: Job approved không có lý do từ chối/ẩn`)
      } else if (!job.moderationReason?.trim()) {
        errors.push(`${job.id}: Job ${job.moderationStatus} phải có lý do`)
      }
    }
    if (!moderationWithinJobHistory) {
      errors.push(`${job.id}: thời gian kiểm duyệt sau updatedAt của Job`)
    }

    if (requireSeedDefaults) {
      const expected = job.status === 'draft' ? 'unsubmitted' : 'approved'
      if (job.moderationStatus !== expected) {
        errors.push(`${job.id}: moderationStatus seed phải là ${expected}`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Dữ liệu kiểm duyệt không hợp lệ:\n- ${errors.slice(0, 40).join('\n- ')}`)
  }
}

export function summarizeAccountModerationData(db) {
  const accountStatuses = Object.fromEntries(
    ['active', 'locked'].map((status) => [
      status,
      db.users.filter((user) => user.accountStatus === status).length,
    ]),
  )
  const jobModerationStatuses = Object.fromEntries(
    [...MODERATION_STATUSES].map((status) => [
      status,
      db.jobs.filter((job) => job.moderationStatus === status).length,
    ]),
  )
  return { accountStatuses, jobModerationStatuses }
}
