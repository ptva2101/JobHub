const DEFAULT_REFERENCE_AT = Date.parse('2026-08-10T08:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRandom(key) {
  let state = hashString(`jobhub-company-engagement|${key}`)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function stableShuffle(values, random) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function validTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function timestampBetween(start, end, random) {
  if (end <= start) return new Date(start).toISOString()
  return new Date(Math.floor(start + random() * (end - start))).toISOString()
}

function engagementReferenceTime(db) {
  const timestamps = [DEFAULT_REFERENCE_AT]
  for (const collectionName of ['users', 'jobs', 'applications', 'bookmarks', 'reviews']) {
    const collection = Array.isArray(db[collectionName]) ? db[collectionName] : []
    for (const item of collection) {
      for (const field of ['createdAt', 'updatedAt', 'appliedAt']) {
        if (validTimestamp(item[field])) timestamps.push(Date.parse(item[field]))
      }
    }
  }
  return Math.max(...timestamps) + DAY
}

function pairKey(candidateId, employerId) {
  return `${candidateId}\u0000${employerId}`
}

function notificationKey(recipientId, type, jobId) {
  return `${recipientId}\u0000${type}\u0000${jobId}`
}

function safeIdPart(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function affinityScoresFor(candidateId, db, jobsById) {
  const scores = new Map()
  const add = (employerId, score) => {
    if (employerId) scores.set(employerId, (scores.get(employerId) ?? 0) + score)
  }

  for (const application of db.applications ?? []) {
    if (application.candidateId === candidateId) {
      add(jobsById.get(application.jobId)?.employerId, 4)
    }
  }
  for (const bookmark of db.bookmarks ?? []) {
    if (bookmark.candidateId === candidateId) {
      add(jobsById.get(bookmark.jobId)?.employerId, 2)
    }
  }
  for (const review of db.reviews ?? []) {
    if (review.candidateId === candidateId) add(review.employerId, 5)
  }

  return scores
}

function createFollow(candidate, employer, employerJobs, referenceTime, random) {
  const earliestTime = Math.max(
    Date.parse(candidate.createdAt),
    Date.parse(employer.createdAt),
  ) + HOUR
  const jobsPostedAfterAccountCreation = employerJobs
    .filter((job) => job.status === 'open' && Date.parse(job.createdAt) > earliestTime + HOUR)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))

  let latestTime = referenceTime - HOUR
  if (jobsPostedAfterAccountCreation.length > 0 && random() < 0.88) {
    const anchorIndex = Math.floor(random() * Math.min(3, jobsPostedAfterAccountCreation.length))
    latestTime = Math.min(
      latestTime,
      Date.parse(jobsPostedAfterAccountCreation[anchorIndex].createdAt) - HOUR,
    )
  }

  const createdAt = timestampBetween(
    Math.min(earliestTime, latestTime),
    Math.max(earliestTime, latestTime),
    random,
  )

  return {
    id: `company_follow_seed_${safeIdPart(candidate.id)}_${safeIdPart(employer.id)}`,
    candidateId: candidate.id,
    employerId: employer.id,
    createdAt,
  }
}

export function generateCompanyEngagementData(db) {
  const candidates = (db.users ?? [])
    .filter((user) => user.role === 'candidate')
    .sort((first, second) => first.id.localeCompare(second.id))
  const employers = (db.users ?? [])
    .filter((user) => user.role === 'employer')
    .sort((first, second) => first.id.localeCompare(second.id))
  const jobs = [...(db.jobs ?? [])].sort((first, second) => first.id.localeCompare(second.id))
  const jobsById = new Map(jobs.map((job) => [job.id, job]))
  const jobsByEmployer = new Map(
    employers.map((employer) => [
      employer.id,
      jobs.filter((job) => job.employerId === employer.id),
    ]),
  )
  const referenceTime = engagementReferenceTime(db)
  const companyFollows = []

  for (const candidate of candidates) {
    const random = createRandom(`follows|${candidate.id}`)
    const targetCount = 2 + (hashString(candidate.id) % 3)
    const affinityScores = affinityScoresFor(candidate.id, db, jobsById)
    const rankedEmployers = employers
      .map((employer) => {
        const candidateCreatedAt = Date.parse(candidate.createdAt)
        const hasLaterOpenJob = (jobsByEmployer.get(employer.id) ?? []).some(
          (job) => job.status === 'open' && Date.parse(job.createdAt) > candidateCreatedAt + 2 * HOUR,
        )
        return {
          employer,
          score: (affinityScores.get(employer.id) ?? 0) + (hasLaterOpenJob ? 3 : 0),
          tieBreaker: hashString(`${candidate.id}|${employer.id}`),
        }
      })
      .sort((first, second) =>
        second.score - first.score || first.tieBreaker - second.tieBreaker,
      )
      .slice(0, Math.min(targetCount, employers.length))

    for (const { employer } of rankedEmployers) {
      companyFollows.push(createFollow(
        candidate,
        employer,
        jobsByEmployer.get(employer.id) ?? [],
        referenceTime,
        random,
      ))
    }
  }

  companyFollows.sort((first, second) =>
    first.candidateId.localeCompare(second.candidateId) ||
    first.employerId.localeCompare(second.employerId),
  )

  const notifications = []
  const followsByCandidate = new Map(
    candidates.map((candidate) => [
      candidate.id,
      companyFollows.filter((follow) => follow.candidateId === candidate.id),
    ]),
  )

  for (const candidate of candidates) {
    const random = createRandom(`notifications|${candidate.id}`)
    const eligiblePairs = (followsByCandidate.get(candidate.id) ?? []).flatMap((follow) =>
      (jobsByEmployer.get(follow.employerId) ?? [])
        .filter((job) =>
          job.status === 'open' && Date.parse(follow.createdAt) < Date.parse(job.createdAt),
        )
        .map((job) => ({ follow, job })),
    )
    const selectedPairs = stableShuffle(eligiblePairs, random).slice(
      0,
      Math.min(eligiblePairs.length, 2 + (hashString(`notifications|${candidate.id}`) % 5)),
    )

    for (const { follow, job } of selectedPairs) {
      const createdTime = Math.min(
        referenceTime,
        Math.max(Date.parse(follow.createdAt), Date.parse(job.createdAt)) +
          (5 + Math.floor(random() * 176)) * 60 * 1000,
      )
      const shouldBeRead = random() < 0.64 && createdTime + HOUR <= referenceTime
      const readAt = shouldBeRead
        ? timestampBetween(createdTime + HOUR, Math.min(referenceTime, createdTime + 10 * DAY), random)
        : null

      notifications.push({
        id: `notification_seed_${safeIdPart(candidate.id)}_${safeIdPart(job.id)}`,
        recipientId: candidate.id,
        type: 'new_job',
        employerId: job.employerId,
        jobId: job.id,
        title: `Việc làm mới từ ${job.companyName}`,
        message: `${job.companyName} vừa đăng tuyển vị trí ${job.title}.`,
        readAt,
        createdAt: new Date(createdTime).toISOString(),
      })
    }
  }

  notifications.sort((first, second) =>
    first.recipientId.localeCompare(second.recipientId) ||
    second.createdAt.localeCompare(first.createdAt) ||
    first.jobId.localeCompare(second.jobId),
  )

  return { companyFollows, notifications }
}

export function mergeCompanyEngagementData(db, generated) {
  const existingFollows = Array.isArray(db.companyFollows) ? [...db.companyFollows] : []
  const existingNotifications = Array.isArray(db.notifications) ? [...db.notifications] : []
  const existingFollowPairs = new Set(
    existingFollows.map((follow) => pairKey(follow.candidateId, follow.employerId)),
  )
  const existingFollowIds = new Map(existingFollows.map((follow) => [follow.id, follow]))
  const currentCounts = new Map()
  for (const follow of existingFollows) {
    currentCounts.set(follow.candidateId, (currentCounts.get(follow.candidateId) ?? 0) + 1)
  }
  const generatedTargets = new Map()
  for (const follow of generated.companyFollows) {
    generatedTargets.set(
      follow.candidateId,
      (generatedTargets.get(follow.candidateId) ?? 0) + 1,
    )
  }

  for (const follow of generated.companyFollows) {
    const key = pairKey(follow.candidateId, follow.employerId)
    if (existingFollowPairs.has(key)) continue
    const idCollision = existingFollowIds.get(follow.id)
    if (idCollision) {
      throw new Error(`ID ${follow.id} đã được dùng cho lượt theo dõi khác.`)
    }
    const target = generatedTargets.get(follow.candidateId) ?? 0
    const count = currentCounts.get(follow.candidateId) ?? 0
    if (count >= target) continue
    existingFollows.push(follow)
    existingFollowIds.set(follow.id, follow)
    existingFollowPairs.add(key)
    currentCounts.set(follow.candidateId, count + 1)
  }

  const finalFollowPairs = new Set(
    existingFollows.map((follow) => pairKey(follow.candidateId, follow.employerId)),
  )
  const existingNotificationKeys = new Set(
    existingNotifications.map((notification) =>
      notificationKey(notification.recipientId, notification.type, notification.jobId),
    ),
  )
  const existingNotificationIds = new Map(
    existingNotifications.map((notification) => [notification.id, notification]),
  )

  for (const notification of generated.notifications) {
    const followKey = pairKey(notification.recipientId, notification.employerId)
    const key = notificationKey(
      notification.recipientId,
      notification.type,
      notification.jobId,
    )
    if (!finalFollowPairs.has(followKey) || existingNotificationKeys.has(key)) continue
    const idCollision = existingNotificationIds.get(notification.id)
    if (idCollision) {
      throw new Error(`ID ${notification.id} đã được dùng cho thông báo khác.`)
    }
    existingNotifications.push(notification)
    existingNotificationIds.set(notification.id, notification)
    existingNotificationKeys.add(key)
  }

  return {
    companyFollows: existingFollows.sort((first, second) =>
      first.candidateId.localeCompare(second.candidateId) ||
      first.employerId.localeCompare(second.employerId),
    ),
    notifications: existingNotifications.sort((first, second) =>
      first.recipientId.localeCompare(second.recipientId) ||
      second.createdAt.localeCompare(first.createdAt),
    ),
  }
}

export function validateCompanyEngagementData(db, { requireFollowRange = true } = {}) {
  const errors = []
  if (!Array.isArray(db.companyFollows)) errors.push('companyFollows phải là một mảng')
  if (!Array.isArray(db.notifications)) errors.push('notifications phải là một mảng')
  if (errors.length > 0) throw new Error(errors.join('\n'))

  const usersById = new Map((db.users ?? []).map((user) => [user.id, user]))
  const jobsById = new Map((db.jobs ?? []).map((job) => [job.id, job]))
  const followIds = new Set()
  const followPairs = new Set()

  for (const follow of db.companyFollows) {
    const candidate = usersById.get(follow.candidateId)
    const employer = usersById.get(follow.employerId)
    const key = pairKey(follow.candidateId, follow.employerId)
    if (!follow.id || followIds.has(follow.id)) errors.push(`${follow.id || '(không ID)'}: ID follow bị trùng`)
    if (followPairs.has(key)) errors.push(`${follow.id}: Candidate đã theo dõi công ty này`)
    followIds.add(follow.id)
    followPairs.add(key)
    if (candidate?.role !== 'candidate') errors.push(`${follow.id}: Candidate không hợp lệ`)
    if (employer?.role !== 'employer') errors.push(`${follow.id}: Employer không hợp lệ`)
    if (!validTimestamp(follow.createdAt)) errors.push(`${follow.id}: createdAt không hợp lệ`)
    else if (
      candidate && employer &&
      (follow.createdAt < candidate.createdAt || follow.createdAt < employer.createdAt)
    ) {
      errors.push(`${follow.id}: theo dõi trước khi tài khoản được tạo`)
    }
  }

  if (requireFollowRange) {
    for (const candidate of (db.users ?? []).filter((user) => user.role === 'candidate')) {
      const count = db.companyFollows.filter((follow) => follow.candidateId === candidate.id).length
      if (count < 2 || count > 4) errors.push(`${candidate.id}: có ${count} follow, cần từ 2 đến 4`)
    }
  }

  const notificationIds = new Set()
  const notificationKeys = new Set()
  for (const notification of db.notifications) {
    const recipient = usersById.get(notification.recipientId)
    const employer = usersById.get(notification.employerId)
    const job = jobsById.get(notification.jobId)
    const key = notificationKey(
      notification.recipientId,
      notification.type,
      notification.jobId,
    )
    const follow = db.companyFollows.find((item) =>
      item.candidateId === notification.recipientId &&
      item.employerId === notification.employerId,
    )

    if (!notification.id || notificationIds.has(notification.id)) errors.push(`${notification.id || '(không ID)'}: ID notification bị trùng`)
    if (notificationKeys.has(key)) errors.push(`${notification.id}: thông báo Job bị trùng cho Candidate`)
    notificationIds.add(notification.id)
    notificationKeys.add(key)
    if (notification.type !== 'new_job') errors.push(`${notification.id}: type không hợp lệ`)
    if (recipient?.role !== 'candidate') errors.push(`${notification.id}: người nhận không hợp lệ`)
    if (employer?.role !== 'employer') errors.push(`${notification.id}: Employer không hợp lệ`)
    if (!job || job.employerId !== notification.employerId) errors.push(`${notification.id}: Job không thuộc Employer`)
    if (!follow) errors.push(`${notification.id}: không có quan hệ theo dõi tương ứng`)
    if (!notification.title?.trim() || !notification.message?.trim()) errors.push(`${notification.id}: thiếu nội dung`)
    if (!validTimestamp(notification.createdAt)) errors.push(`${notification.id}: createdAt không hợp lệ`)
    else {
      if (follow && notification.createdAt < follow.createdAt) errors.push(`${notification.id}: được gửi trước lượt theo dõi`)
      if (job && notification.createdAt < job.createdAt) errors.push(`${notification.id}: được gửi trước khi Job được đăng`)
    }
    if (
      notification.readAt !== null &&
      (!validTimestamp(notification.readAt) || notification.readAt < notification.createdAt)
    ) {
      errors.push(`${notification.id}: readAt không hợp lệ`)
    }
  }

  if (db.notifications.length > 0) {
    const readCount = db.notifications.filter((notification) => notification.readAt !== null).length
    if (readCount === 0 || readCount === db.notifications.length) {
      errors.push('notifications cần có cả trạng thái đã đọc và chưa đọc')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Dữ liệu theo dõi/thông báo không hợp lệ:\n- ${errors.slice(0, 40).join('\n- ')}`)
  }
}

export function summarizeCompanyEngagementData(db) {
  const candidates = (db.users ?? []).filter((user) => user.role === 'candidate')
  const followCounts = candidates.map((candidate) =>
    db.companyFollows.filter((follow) => follow.candidateId === candidate.id).length,
  )
  const unread = db.notifications.filter((notification) => notification.readAt === null).length
  return {
    companyFollows: db.companyFollows.length,
    followsPerCandidate: {
      min: followCounts.length > 0 ? Math.min(...followCounts) : 0,
      max: followCounts.length > 0 ? Math.max(...followCounts) : 0,
      average: followCounts.length > 0
        ? Number((followCounts.reduce((total, count) => total + count, 0) / followCounts.length).toFixed(2))
        : 0,
    },
    notifications: db.notifications.length,
    read: db.notifications.length - unread,
    unread,
  }
}
