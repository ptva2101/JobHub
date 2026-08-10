import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addAccountModerationDefaults,
  summarizeAccountModerationData,
  validateAccountModerationData,
} from './accountModerationData.mjs'
import {
  generateCompanyEngagementData,
  summarizeCompanyEngagementData,
  validateCompanyEngagementData,
} from './companyEngagementData.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = resolve(projectRoot, 'db.json')
const backupPath = resolve(projectRoot, 'db.before-large-seed.json')
const checkOnly = process.argv.includes('--check')
const dryRun = process.argv.includes('--dry-run')
const baseDate = new Date('2026-08-09T08:00:00.000Z')
const baseDay = '2026-08-09'

let randomState = 20260809
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0
  return randomState / 4294967296
}
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min
const pick = (items) => items[randomInt(0, items.length - 1)]
function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index)
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}
const repeat = (value, count) => Array.from({ length: count }, () => value)
const pad = (value, length = 3) => String(value).padStart(length, '0')
const isoDaysFromBase = (days, hour = 8) => {
  const date = new Date(baseDate)
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(hour, randomInt(0, 59), randomInt(0, 59), 0)
  return date.toISOString()
}
const dateOnlyDaysFromBase = (days) => isoDaysFromBase(days).slice(0, 10)
const addDays = (iso, days) => {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  if (date > baseDate) return baseDate.toISOString()
  return date.toISOString()
}
const dayOffsetFromBase = (value) => Math.round(
  (Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`) - Date.parse(`${baseDay}T00:00:00.000Z`)) / 86400000,
)

const companies = [
  ['user_employer_01', 'employer@jobhub.vn', 'Trần Thanh Tùng', 'JobHub Technology', 'jobhub', 'Công nghệ thông tin', '51-100 nhân viên', 'Quận 1, TP. Hồ Chí Minh', 16],
  ['user_employer_02', 'hr@brightsoft.vn', 'Lê Hoàng Lan', 'BrightSoft Vietnam', 'brightsoft', 'Phần mềm', '101-500 nhân viên', 'Cầu Giấy, Hà Nội', 16],
  ['user_employer_03', 'hr@finova.vn', 'Nguyễn Hoàng Minh', 'Finova Finance', 'finova', 'Tài chính', '101-500 nhân viên', 'Quận 3, TP. Hồ Chí Minh', 14],
  ['user_employer_04', 'hr@greenmart.vn', 'Phạm Thu Hà', 'GreenMart Retail', 'greenmart', 'Bán lẻ', '501-1000 nhân viên', 'Thủ Đức, TP. Hồ Chí Minh', 13],
  ['user_employer_05', 'hr@novamedia.vn', 'Đỗ Minh Trang', 'NovaMedia', 'novamedia', 'Truyền thông', '51-100 nhân viên', 'Ba Đình, Hà Nội', 12],
  ['user_employer_06', 'hr@edunext.vn', 'Vũ Hải Nam', 'EduNext', 'edunext', 'Giáo dục', '101-500 nhân viên', 'Thanh Xuân, Hà Nội', 11],
  ['user_employer_07', 'hr@healthplus.vn', 'Bùi Ngọc Anh', 'HealthPlus', 'healthplus', 'Y tế', '101-500 nhân viên', 'Quận 10, TP. Hồ Chí Minh', 10],
  ['user_employer_08', 'hr@logifast.vn', 'Hoàng Quốc Bảo', 'LogiFast', 'logifast', 'Logistics', '501-1000 nhân viên', 'Hải Châu, Đà Nẵng', 12],
  ['user_employer_09', 'hr@designlab.vn', 'Ngô Phương Linh', 'DesignLab', 'designlab', 'Thiết kế', '11-50 nhân viên', 'Hoàn Kiếm, Hà Nội', 9],
  ['user_employer_10', 'hr@mekongretail.vn', 'Dương Thanh Mai', 'Mekong Retail', 'mekong-retail', 'Bán lẻ', '101-500 nhân viên', 'Ninh Kiều, Cần Thơ', 11],
  ['user_employer_11', 'hr@cloudnine.vn', 'Lý Tuấn Kiệt', 'CloudNine Solutions', 'cloudnine', 'Điện toán đám mây', '101-500 nhân viên', 'Quận 7, TP. Hồ Chí Minh', 12],
  ['user_employer_12', 'hr@sunrisehospitality.vn', 'Trương Bảo Ngọc', 'Sunrise Hospitality', 'sunrise', 'Du lịch - Khách sạn', '501-1000 nhân viên', 'Sơn Trà, Đà Nẵng', 8],
].map(([id, email, fullName, name, slug, industry, companySize, address, jobCount], index) => ({
  id, email, fullName, name, slug, industry, companySize, address, jobCount,
  phone: `0901${String(index + 1).padStart(6, '0')}`,
}))

const admin = {
  id: 'user_admin_01', email: 'admin@jobhub.vn', password: '123456', role: 'admin',
  fullName: 'JobHub Admin', phone: '0900000001', avatarUrl: null,
  candidateProfile: null, companyProfile: null,
  createdAt: '2026-01-01T08:00:00.000Z', updatedAt: '2026-01-01T08:00:00.000Z',
}

const employers = companies.map((company, index) => ({
  id: company.id, email: company.email, password: '123456', role: 'employer',
  fullName: company.fullName, phone: company.phone, avatarUrl: null, candidateProfile: null,
  companyProfile: {
    name: company.name, logoUrl: `/companies/${company.slug}.png`, industry: company.industry,
    companySize: company.companySize, address: company.address,
    website: `https://${company.slug}.example.com`,
    description: `${company.name} xây dựng môi trường làm việc chuyên nghiệp, minh bạch và chú trọng phát triển con người.`,
  },
  createdAt: isoDaysFromBase(-300 + index * 5), updatedAt: isoDaysFromBase(-30 + index),
}))

const familyNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý']
const middleNames = ['Minh', 'Thanh', 'Quang', 'Thu', 'Ngọc', 'Hoài', 'Đức', 'Gia', 'Khánh', 'Hải', 'Tuấn', 'Phương']
const givenNames = ['Anh', 'An', 'Bảo', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hạnh', 'Hiếu', 'Hùng', 'Huy', 'Khang', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nga', 'Ngân', 'Nhung', 'Phong', 'Phúc', 'Quân', 'Quỳnh', 'Sơn', 'Thảo', 'Trang', 'Trung', 'Tú', 'Vy']

const careerProfiles = [
  ['Frontend Developer', ['ReactJS', 'TypeScript', 'Tailwind CSS', 'Git', 'REST API']],
  ['Backend Developer', ['Node.js', 'Java', 'PostgreSQL', 'Docker', 'REST API']],
  ['UI/UX Designer', ['Figma', 'Design System', 'Prototyping', 'User Research']],
  ['Digital Marketing', ['SEO', 'Content Marketing', 'Google Ads', 'Social Media']],
  ['Sales Executive', ['B2B Sales', 'CRM', 'Đàm phán', 'Chăm sóc khách hàng']],
  ['Kế toán viên', ['Excel', 'Kế toán tổng hợp', 'MISA', 'Báo cáo tài chính']],
  ['Chuyên viên nhân sự', ['Tuyển dụng', 'C&B', 'Đào tạo', 'Giao tiếp']],
  ['Logistics Coordinator', ['Supply Chain', 'Excel', 'Quản lý kho', 'Vận tải']],
  ['Giáo viên tiếng Anh', ['IELTS', 'Lesson Planning', 'Thuyết trình', 'Giao tiếp']],
  ['Chuyên viên vận hành', ['Quản lý vận hành', 'Excel', 'Phân tích dữ liệu', 'Giải quyết vấn đề']],
]

function makeCandidate(index) {
  if (index === 1) {
    return {
      id: 'user_candidate_01', email: 'candidate@jobhub.vn', password: '123456', role: 'candidate',
      fullName: 'Nguyễn Việt Anh', phone: '0900000004', avatarUrl: null,
      candidateProfile: {
        headline: 'Frontend Developer', address: 'Hà Nội',
        bio: 'Ứng viên có 2 năm kinh nghiệm phát triển sản phẩm với ReactJS.', yearsOfExperience: 2,
        skills: ['ReactJS', 'TypeScript', 'Tailwind CSS', 'Git', 'REST API'],
        experiences: [{ id: 'experience_candidate_001_1', companyName: 'ABC Software', position: 'Frontend Developer', startDate: '2024-01-01', endDate: null, description: 'Phát triển giao diện web và tích hợp REST API.' }],
        educations: [{ id: 'education_candidate_001_1', schoolName: 'Đại học Công nghệ', major: 'Công nghệ thông tin', startYear: 2020, endYear: 2024 }],
        cvUrl: '/cvs/nguyen-viet-anh.pdf',
      },
      companyProfile: null, createdAt: '2026-01-01T08:00:00.000Z', updatedAt: isoDaysFromBase(-5),
    }
  }

  const profileType = index <= 168 ? 'complete' : index <= 216 ? 'partial' : 'minimal'
  const career = careerProfiles[(index - 1) % careerProfiles.length]
  const fullName = `${familyNames[(index * 7) % familyNames.length]} ${middleNames[(index * 5) % middleNames.length]} ${givenNames[(index * 11) % givenNames.length]}`
  const years = profileType === 'minimal' ? 0 : randomInt(0, 8)
  const experienceCount = profileType === 'complete' ? randomInt(1, 3) : profileType === 'partial' ? randomInt(0, 1) : 0
  const experiences = Array.from({ length: experienceCount }, (_, experienceIndex) => ({
    id: `experience_candidate_${pad(index)}_${experienceIndex + 1}`,
    companyName: pick(companies).name,
    position: career[0],
    startDate: `${2025 - experienceIndex - Math.min(years, 4)}-0${randomInt(1, 9)}-01`,
    endDate: experienceIndex === 0 && random() < 0.35 ? null : `${2025 - experienceIndex}-12-01`,
    description: `Thực hiện các nhiệm vụ ${career[0].toLocaleLowerCase('vi')} và phối hợp cùng đội ngũ để hoàn thành mục tiêu.`,
  }))
  const hasCv = profileType === 'complete' ? random() < 0.9 : profileType === 'partial' ? random() < 0.55 : false
  const createdDaysAgo = randomInt(20, 360)
  return {
    id: `user_candidate_${pad(index)}`, email: `candidate${pad(index)}@jobhub.vn`, password: '123456', role: 'candidate',
    fullName, phone: `09${String(10000000 + index * 7919).slice(-8)}`, avatarUrl: null,
    candidateProfile: {
      headline: profileType === 'minimal' ? '' : career[0],
      address: profileType === 'minimal' ? '' : pick(['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'Bình Dương']),
      bio: profileType === 'complete' ? `Có ${years} năm kinh nghiệm trong lĩnh vực ${career[0]} và mong muốn phát triển trong môi trường chuyên nghiệp.` : '',
      yearsOfExperience: years,
      skills: profileType === 'minimal' ? [] : shuffle(career[1]).slice(0, profileType === 'complete' ? randomInt(4, career[1].length) : 2),
      experiences,
      educations: profileType === 'minimal' ? [] : [{ id: `education_candidate_${pad(index)}_1`, schoolName: pick(['Đại học Quốc gia Hà Nội', 'Đại học Bách khoa', 'Đại học Kinh tế Quốc dân', 'Đại học FPT', 'Đại học Đà Nẵng', 'Đại học Cần Thơ']), major: career[0], startYear: 2016 + (index % 6), endYear: 2020 + (index % 6) }],
      cvUrl: hasCv ? `/cvs/candidate-${pad(index)}.pdf` : null,
    },
    companyProfile: null,
    createdAt: isoDaysFromBase(-createdDaysAgo),
    updatedAt: isoDaysFromBase(-randomInt(0, Math.min(createdDaysAgo - 1, 45))),
  }
}

const candidates = Array.from({ length: 240 }, (_, index) => makeCandidate(index + 1))
const candidateCategoryCycle = [
  'Công nghệ thông tin', 'Công nghệ thông tin', 'Thiết kế', 'Marketing',
  'Kinh doanh/Bán hàng', 'Tài chính/Kế toán', 'Nhân sự', 'Logistics',
  'Giáo dục', 'Vận hành/Dịch vụ',
]
const candidateCategoryById = new Map(
  candidates.map((candidate, index) => [candidate.id, candidateCategoryCycle[index % candidateCategoryCycle.length]]),
)
const suitableCandidateCategories = {
  'Chăm sóc khách hàng': ['Kinh doanh/Bán hàng', 'Vận hành/Dịch vụ', 'Marketing'],
}

const categoryCounts = {
  'Công nghệ thông tin': 30, 'Kinh doanh/Bán hàng': 20, Marketing: 16,
  'Tài chính/Kế toán': 14, 'Thiết kế': 12, 'Chăm sóc khách hàng': 12,
  'Nhân sự': 10, Logistics: 10, 'Giáo dục': 10, 'Vận hành/Dịch vụ': 10,
}
const locationCounts = { 'TP. Hồ Chí Minh': 45, 'Hà Nội': 38, 'Toàn quốc': 18, 'Đà Nẵng': 16, 'Cần Thơ': 8, 'Hải Phòng': 7, 'Bình Dương': 7, 'Đồng Nai': 5 }
const statusValues = [...repeat('open', 90), ...repeat('closed', 42), ...repeat('draft', 12)]
const employmentValues = [...repeat('full-time', 90), ...repeat('part-time', 20), ...repeat('internship', 18), ...repeat('contract', 16)]
const workplaceValues = [...repeat('on-site', 72), ...repeat('hybrid', 38), ...repeat('remote', 34)]
const expandCounts = (counts) => Object.entries(counts).flatMap(([value, count]) => repeat(value, count))

function sequenceWithFixed(values, fixedValues) {
  const remaining = [...values]
  for (const fixedValue of fixedValues) remaining.splice(remaining.indexOf(fixedValue), 1)
  return [...fixedValues, ...shuffle(remaining)]
}

const locations = sequenceWithFixed(expandCounts(locationCounts), ['TP. Hồ Chí Minh', 'Hà Nội', 'Toàn quốc', 'Đà Nẵng'])
const statusesForJobs = sequenceWithFixed(statusValues, ['open', 'open', 'open', 'closed'])
const employmentTypes = sequenceWithFixed(employmentValues, ['full-time', 'full-time', 'internship', 'part-time'])
const workplaceTypes = sequenceWithFixed(workplaceValues, ['hybrid', 'on-site', 'remote', 'remote'])

const titleByCategory = {
  'Công nghệ thông tin': ['Frontend Developer', 'Backend Developer', 'Full-stack Developer', 'Mobile Developer', 'QA Engineer', 'DevOps Engineer', 'Data Analyst', 'IT Support'],
  'Kinh doanh/Bán hàng': ['Sales Executive', 'Business Development Executive', 'Trưởng nhóm kinh doanh', 'Tư vấn bán hàng', 'Account Executive'],
  Marketing: ['Content Marketing', 'Digital Marketing Executive', 'SEO Specialist', 'Social Media Executive', 'Marketing Intern'],
  'Tài chính/Kế toán': ['Kế toán tổng hợp', 'Chuyên viên tài chính', 'Kiểm toán nội bộ', 'Kế toán công nợ', 'Financial Analyst'],
  'Thiết kế': ['UI/UX Designer', 'Graphic Designer', 'Product Designer', 'Motion Designer'],
  'Chăm sóc khách hàng': ['Chuyên viên chăm sóc khách hàng', 'Customer Success Executive', 'Tổng đài viên', 'Customer Support'],
  'Nhân sự': ['Chuyên viên tuyển dụng', 'HR Generalist', 'Chuyên viên C&B', 'HR Intern'],
  Logistics: ['Logistics Coordinator', 'Nhân viên xuất nhập khẩu', 'Điều phối vận tải', 'Quản lý kho'],
  'Giáo dục': ['Giáo viên tiếng Anh', 'Chuyên viên đào tạo', 'Trợ giảng', 'Tư vấn tuyển sinh'],
  'Vận hành/Dịch vụ': ['Chuyên viên vận hành', 'Quản lý cửa hàng', 'Nhân viên dịch vụ khách hàng', 'Điều phối viên'],
}
const skillByCategory = {
  'Công nghệ thông tin': ['JavaScript', 'TypeScript', 'ReactJS', 'Node.js', 'Git'],
  'Kinh doanh/Bán hàng': ['B2B Sales', 'CRM', 'Đàm phán', 'Giao tiếp'],
  Marketing: ['SEO', 'Content Marketing', 'Google Ads', 'Social Media'],
  'Tài chính/Kế toán': ['Excel', 'MISA', 'Báo cáo tài chính', 'Phân tích'],
  'Thiết kế': ['Figma', 'Adobe Illustrator', 'Design System', 'Prototyping'],
  'Chăm sóc khách hàng': ['Giao tiếp', 'CRM', 'Xử lý khiếu nại', 'Tư vấn'],
  'Nhân sự': ['Tuyển dụng', 'C&B', 'Đào tạo', 'Luật lao động'],
  Logistics: ['Supply Chain', 'Quản lý kho', 'Vận tải', 'Excel'],
  'Giáo dục': ['Thuyết trình', 'Lesson Planning', 'Giao tiếp', 'Đào tạo'],
  'Vận hành/Dịch vụ': ['Quản lý vận hành', 'Excel', 'Giải quyết vấn đề', 'Lập kế hoạch'],
}

const remainingCompanyJobs = companies.map((company) => company.jobCount)
const companySequence = []
for (const companyIndex of [0, 1, 0, 1]) {
  companySequence.push(companyIndex)
  remainingCompanyJobs[companyIndex] -= 1
}
while (companySequence.length < 144) {
  for (let companyIndex = 0; companyIndex < companies.length && companySequence.length < 144; companyIndex += 1) {
    if (remainingCompanyJobs[companyIndex] > 0) {
      companySequence.push(companyIndex)
      remainingCompanyJobs[companyIndex] -= 1
    }
  }
}

const companyCategoryPlans = [
  { 'Công nghệ thông tin': 10, 'Thiết kế': 2, 'Kinh doanh/Bán hàng': 1, Marketing: 1, 'Nhân sự': 1, 'Chăm sóc khách hàng': 1 },
  { 'Công nghệ thông tin': 12, 'Thiết kế': 2, 'Kinh doanh/Bán hàng': 1, 'Nhân sự': 1 },
  { 'Tài chính/Kế toán': 9, 'Công nghệ thông tin': 2, 'Kinh doanh/Bán hàng': 1, 'Chăm sóc khách hàng': 1, 'Nhân sự': 1 },
  { 'Kinh doanh/Bán hàng': 5, 'Vận hành/Dịch vụ': 3, Logistics: 1, Marketing: 2, 'Chăm sóc khách hàng': 1, 'Nhân sự': 1 },
  { Marketing: 8, 'Thiết kế': 3, 'Kinh doanh/Bán hàng': 1 },
  { 'Giáo dục': 8, Marketing: 1, 'Kinh doanh/Bán hàng': 1, 'Chăm sóc khách hàng': 1 },
  { 'Chăm sóc khách hàng': 3, 'Vận hành/Dịch vụ': 3, 'Tài chính/Kế toán': 1, 'Nhân sự': 1, 'Giáo dục': 1, 'Kinh doanh/Bán hàng': 1 },
  { Logistics: 8, 'Vận hành/Dịch vụ': 2, 'Công nghệ thông tin': 1, 'Kinh doanh/Bán hàng': 1 },
  { 'Thiết kế': 5, Marketing: 2, 'Công nghệ thông tin': 1, 'Kinh doanh/Bán hàng': 1 },
  { 'Kinh doanh/Bán hàng': 4, 'Chăm sóc khách hàng': 2, 'Vận hành/Dịch vụ': 1, Logistics: 1, Marketing: 1, 'Tài chính/Kế toán': 1, 'Nhân sự': 1 },
  { 'Công nghệ thông tin': 4, 'Kinh doanh/Bán hàng': 1, 'Tài chính/Kế toán': 2, 'Nhân sự': 2, 'Chăm sóc khách hàng': 1, 'Giáo dục': 1, Marketing: 1 },
  { 'Kinh doanh/Bán hàng': 2, 'Tài chính/Kế toán': 1, 'Chăm sóc khách hàng': 2, 'Nhân sự': 2, 'Vận hành/Dịch vụ': 1 },
]
const fixedCategories = ['Công nghệ thông tin', 'Thiết kế', 'Marketing', 'Công nghệ thông tin']
const companyCategoryQueues = companyCategoryPlans.map((plan) => shuffle(expandCounts(plan)))
for (const [jobIndex, category] of fixedCategories.entries()) {
  const companyIndex = companySequence[jobIndex]
  const categoryIndex = companyCategoryQueues[companyIndex].indexOf(category)
  if (categoryIndex < 0) throw new Error(`Thiếu category ${category} cho ${companies[companyIndex].name}`)
  companyCategoryQueues[companyIndex].splice(categoryIndex, 1)
}
const categories = companySequence.map((companyIndex, jobIndex) =>
  fixedCategories[jobIndex] ?? companyCategoryQueues[companyIndex].pop(),
)

function salaryFor(category, employmentType) {
  const base = {
    'Công nghệ thông tin': [15000000, 35000000], 'Kinh doanh/Bán hàng': [9000000, 25000000],
    Marketing: [9000000, 22000000], 'Tài chính/Kế toán': [10000000, 25000000],
    'Thiết kế': [10000000, 26000000], 'Chăm sóc khách hàng': [7000000, 15000000],
    'Nhân sự': [9000000, 22000000], Logistics: [9000000, 22000000],
    'Giáo dục': [8000000, 20000000], 'Vận hành/Dịch vụ': [8000000, 20000000],
  }[category]
  const multiplier = employmentType === 'internship' ? 0.3 : employmentType === 'part-time' ? 0.6 : 1
  const min = Math.round((base[0] * multiplier + randomInt(0, 4) * 500000) / 100000) * 100000
  const max = Math.max(min + 2000000, Math.round((base[1] * multiplier + randomInt(0, 6) * 500000) / 100000) * 100000)
  return { min, max, currency: 'VND', negotiable: random() < 0.12 }
}

const jobs = Array.from({ length: 144 }, (_, arrayIndex) => {
  const index = arrayIndex + 1
  const company = companies[companySequence[arrayIndex]]
  const category = categories[arrayIndex]
  const status = statusesForJobs[arrayIndex]
  const employmentType = employmentTypes[arrayIndex]
  const createdDaysAgo = randomInt(status === 'open' ? 5 : 30, status === 'draft' ? 90 : 240)
  const createdDay = -createdDaysAgo
  const deadlineDay = status === 'open'
    ? randomInt(15, 180)
    : status === 'closed'
      ? random() < 0.75 ? randomInt(createdDay + 7, -1) : randomInt(10, 80)
      : randomInt(30, 160)
  const deadline = dateOnlyDaysFromBase(deadlineDay)
  const forcedTitles = ['ReactJS Developer', 'UI/UX Designer', 'Content Marketing Intern', 'Node.js Developer']
  const titleBase = forcedTitles[arrayIndex] ?? pick(titleByCategory[category])
  const title = arrayIndex < 4 ? titleBase : `${titleBase}${index % 5 === 0 ? ' Senior' : index % 7 === 0 ? ' Junior' : ''}`
  const skills = shuffle(skillByCategory[category]).slice(0, randomInt(3, Math.min(5, skillByCategory[category].length)))
  return {
    id: `job_${String(index).padStart(2, '0')}`, employerId: company.id, title,
    companyName: company.name, companyLogoUrl: `/companies/${company.slug}.png`, category,
    location: locations[arrayIndex], employmentType, workplaceType: workplaceTypes[arrayIndex],
    salary: salaryFor(category, employmentType),
    description: `${company.name} tuyển dụng ${title}. Bạn sẽ tham gia đội ngũ ${category.toLocaleLowerCase('vi')} và phối hợp với các bộ phận để tạo ra kết quả bền vững.`,
    requirements: [`Có kiến thức hoặc kinh nghiệm phù hợp với vị trí ${title}`, 'Chủ động, có trách nhiệm và giao tiếp tốt', `Sử dụng được ${skills[0]}`],
    benefits: shuffle(['Lương tháng 13', 'Bảo hiểm đầy đủ', 'Đào tạo chuyên môn', 'Thưởng hiệu suất', 'Khám sức khỏe định kỳ', 'Môi trường làm việc linh hoạt']).slice(0, 3),
    skills, deadline, status,
    createdAt: isoDaysFromBase(-createdDaysAgo), updatedAt: isoDaysFromBase(-randomInt(0, Math.min(createdDaysAgo - 1, 20))),
  }
})

const applicationStatuses = ['pending', 'reviewing', 'interviewed', 'accepted', 'rejected']
const weightedStatus = (jobStatus) => {
  const weights = jobStatus === 'closed' ? [5, 10, 15, 20, 50] : [30, 30, 18, 7, 15]
  let roll = randomInt(1, 100)
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index]
    if (roll <= 0) return applicationStatuses[index]
  }
  return 'pending'
}

function makeStatusHistory(status, candidateId, employerId, appliedAt) {
  const history = [{ status: 'pending', changedBy: candidateId, changedAt: appliedAt, note: 'Ứng viên đã nộp hồ sơ' }]
  if (status === 'pending') return history
  let cursor = addDays(appliedAt, randomInt(1, 3))
  history.push({ status: 'reviewing', changedBy: employerId, changedAt: cursor, note: 'Nhà tuyển dụng bắt đầu xem xét hồ sơ' })
  if (status === 'reviewing') return history
  if (status === 'interviewed' || status === 'accepted' || (status === 'rejected' && random() < 0.55)) {
    cursor = addDays(cursor, randomInt(2, 6))
    history.push({ status: 'interviewed', changedBy: employerId, changedAt: cursor, note: 'Ứng viên đã được mời tham gia phỏng vấn' })
  }
  if (status === 'interviewed') return history
  cursor = addDays(cursor, randomInt(2, 7))
  history.push({ status, changedBy: employerId, changedAt: cursor, note: status === 'accepted' ? 'Ứng viên đáp ứng yêu cầu và được tiếp nhận' : 'Hồ sơ chưa phù hợp với vị trí hiện tại' })
  return history
}

const applications = []
for (const [jobIndex, job] of jobs.entries()) {
  if (job.status === 'draft') continue
  const applicationCount = job.status === 'closed'
    ? randomInt(10, 18)
    : jobIndex % 10 === 0 ? randomInt(15, 22) : randomInt(5, 12)
  const jobCreatedDay = dayOffsetFromBase(job.createdAt)
  const lastApplicationDay = Math.min(-1, dayOffsetFromBase(job.deadline))
  const eligibleCandidates = candidates.filter(
    (candidate) => dayOffsetFromBase(candidate.createdAt) + 1 <= lastApplicationDay,
  )
  const acceptedCategories = suitableCandidateCategories[job.category] ?? [job.category]
  const matchingCandidates = shuffle(
    eligibleCandidates.filter((candidate) => acceptedCategories.includes(candidateCategoryById.get(candidate.id))),
  ).slice(0, Math.round(applicationCount * 0.7))
  const matchingCandidateIds = new Set(matchingCandidates.map((candidate) => candidate.id))
  const selectedCandidates = [
    ...matchingCandidates,
    ...shuffle(eligibleCandidates.filter((candidate) => !matchingCandidateIds.has(candidate.id)))
      .slice(0, applicationCount - matchingCandidates.length),
  ]
  for (const candidate of selectedCandidates) {
    const status = weightedStatus(job.status)
    const earliestDay = Math.max(jobCreatedDay + 1, dayOffsetFromBase(candidate.createdAt) + 1)
    const appliedAt = isoDaysFromBase(randomInt(earliestDay, lastApplicationDay), randomInt(7, 17))
    const statusHistory = makeStatusHistory(status, candidate.id, job.employerId, appliedAt)
    const shouldNotify = ['accepted', 'rejected'].includes(status) ? random() < 0.75 : random() < 0.3
    const lastNotification = shouldNotify ? {
      channel: random() < 0.65 ? 'email' : 'in-app',
      message: `Hồ sơ ứng tuyển vị trí ${job.title} của bạn hiện ở trạng thái “${status}”.`,
      sentAt: addDays(statusHistory.at(-1).changedAt, 1),
    } : null
    applications.push({
      id: `application_${pad(applications.length + 1, 4)}`, jobId: job.id, candidateId: candidate.id,
      cvUrl: candidate.candidateProfile?.cvUrl ?? `/cvs/application-candidate-${candidate.id.split('_').at(-1)}.pdf`,
      coverLetter: pick([
        `Tôi quan tâm vị trí ${job.title} và tin rằng kinh nghiệm của mình phù hợp với yêu cầu công việc.`,
        `Tôi mong muốn được đồng hành cùng ${job.companyName} và đóng góp vào các mục tiêu của đội ngũ.`,
        `Với kỹ năng hiện có, tôi hy vọng có cơ hội trao đổi thêm về vị trí ${job.title}.`,
      ]),
      status, statusHistory, lastNotification,
      appliedAt, updatedAt: lastNotification?.sentAt ?? statusHistory.at(-1).changedAt,
    })
  }
}

const openJobs = jobs.filter((job) => job.status === 'open')
const bookmarks = []
const bookmarkPairs = new Set()
while (bookmarks.length < 1200) {
  const candidate = pick(candidates)
  const job = pick(openJobs)
  const pair = `${candidate.id}:${job.id}`
  if (bookmarkPairs.has(pair)) continue
  bookmarkPairs.add(pair)
  const earliestBookmarkDay = Math.max(
    dayOffsetFromBase(candidate.createdAt),
    dayOffsetFromBase(job.createdAt),
  ) + 1
  bookmarks.push({
    id: `bookmark_${pad(bookmarks.length + 1, 4)}`,
    candidateId: candidate.id,
    jobId: job.id,
    createdAt: isoDaysFromBase(randomInt(earliestBookmarkDay, 0)),
  })
}

const reviewTitles = ['Môi trường chuyên nghiệp', 'Quy trình tuyển dụng rõ ràng', 'Trải nghiệm tích cực', 'Phản hồi nhanh', 'Cơ hội phát triển tốt', 'Cần cải thiện giao tiếp']
const reviewContents = ['Nhà tuyển dụng cung cấp thông tin rõ ràng và phản hồi đúng thời gian.', 'Môi trường thân thiện, đồng nghiệp hỗ trợ và quy trình làm việc minh bạch.', 'Buổi phỏng vấn diễn ra chuyên nghiệp, câu hỏi phù hợp với vị trí.', 'Công ty có nhiều cơ hội học hỏi nhưng thời gian phản hồi có thể nhanh hơn.', 'Chế độ đãi ngộ và lộ trình phát triển được trao đổi cụ thể.']
const reviews = []
const reviewPairs = new Set()
while (reviews.length < 320) {
  const candidate = pick(candidates)
  const employerIndex = randomInt(0, employers.length - 1)
  const employer = employers[employerIndex]
  const pair = `${candidate.id}:${employer.id}`
  if (reviewPairs.has(pair)) continue
  reviewPairs.add(pair)
  const companyRatingBase = 3.6 + (employerIndex % 6) * 0.22
  const rating = Math.max(1, Math.min(5, Math.round(companyRatingBase + (random() - 0.5) * 1.5)))
  const earliestReviewDay = Math.max(
    dayOffsetFromBase(candidate.createdAt),
    dayOffsetFromBase(employer.createdAt),
  ) + 1
  const createdAt = isoDaysFromBase(randomInt(earliestReviewDay, -1))
  reviews.push({ id: `review_${pad(reviews.length + 1, 4)}`, candidateId: candidate.id, employerId: employer.id, rating, title: pick(reviewTitles), content: pick(reviewContents), createdAt, updatedAt: createdAt })
}

const coreGeneratedDb = { users: [admin, ...employers, ...candidates], jobs, applications, bookmarks, reviews }
const engagementData = generateCompanyEngagementData(coreGeneratedDb)
const generatedDb = addAccountModerationDefaults({ ...coreGeneratedDb, ...engagementData })

function validateDb(db, requirePlannedCounts = false) {
  const errors = []
  const isValidDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
  const collections = ['users', 'jobs', 'applications', 'bookmarks', 'reviews', 'companyFollows', 'notifications']
  for (const collection of collections) {
    if (!Array.isArray(db[collection])) errors.push(`${collection} phải là một mảng`)
  }
  if (errors.length) throw new Error(errors.join('\n'))

  for (const collection of collections) {
    const ids = db[collection].map((item) => item.id)
    if (new Set(ids).size !== ids.length) errors.push(`${collection} có ID trùng`)
  }
  const emails = db.users.map((user) => user.email.toLocaleLowerCase())
  if (new Set(emails).size !== emails.length) errors.push('users có email trùng')
  const usersById = new Map(db.users.map((user) => [user.id, user]))
  const jobsById = new Map(db.jobs.map((job) => [job.id, job]))
  const pairSet = (values, key, label) => {
    const pairs = values.map(key)
    if (new Set(pairs).size !== pairs.length) errors.push(`${label} có quan hệ trùng`)
  }
  pairSet(db.applications, (item) => `${item.candidateId}:${item.jobId}`, 'applications')
  pairSet(db.bookmarks, (item) => `${item.candidateId}:${item.jobId}`, 'bookmarks')
  pairSet(db.reviews, (item) => `${item.candidateId}:${item.employerId}`, 'reviews')

  for (const user of db.users) {
    if (!isValidDate(user.createdAt) || !isValidDate(user.updatedAt)) errors.push(`${user.id} có thời gian không hợp lệ`)
    else if (user.updatedAt < user.createdAt) errors.push(`${user.id} cập nhật trước khi được tạo`)
  }

  for (const job of db.jobs) {
    if (usersById.get(job.employerId)?.role !== 'employer') errors.push(`${job.id} không có Employer hợp lệ`)
    if (job.salary.min < 0 || job.salary.max < job.salary.min) errors.push(`${job.id} có lương không hợp lệ`)
    if (!isValidDate(job.createdAt) || !isValidDate(job.updatedAt) || !isValidDate(job.deadline)) errors.push(`${job.id} có thời gian không hợp lệ`)
    else {
      if (job.updatedAt < job.createdAt) errors.push(`${job.id} cập nhật trước khi được tạo`)
      if (job.deadline < job.createdAt.slice(0, 10)) errors.push(`${job.id} hết hạn trước khi được tạo`)
    }
    if (job.status === 'open' && job.deadline < baseDay) errors.push(`${job.id} đang mở nhưng đã hết hạn`)
  }
  for (const application of db.applications) {
    const job = jobsById.get(application.jobId)
    const candidate = usersById.get(application.candidateId)
    if (!job || job.status === 'draft') errors.push(`${application.id} tham chiếu Job không hợp lệ`)
    if (candidate?.role !== 'candidate') errors.push(`${application.id} không có Candidate hợp lệ`)
    if (!isValidDate(application.appliedAt) || !isValidDate(application.updatedAt)) errors.push(`${application.id} có thời gian không hợp lệ`)
    else if (job && candidate) {
      if (application.appliedAt < job.createdAt || application.appliedAt < candidate.createdAt) errors.push(`${application.id} được nộp trước khi Job hoặc Candidate được tạo`)
      if (application.appliedAt.slice(0, 10) > job.deadline) errors.push(`${application.id} được nộp sau hạn tuyển dụng`)
    }
    if (application.statusHistory.at(-1)?.status !== application.status) errors.push(`${application.id} có statusHistory sai`)
    const historyTimes = application.statusHistory.map((item) => item.changedAt)
    if (historyTimes.some((time) => !isValidDate(time) || time < application.appliedAt)) errors.push(`${application.id} có mốc lịch sử không hợp lệ`)
    if (historyTimes.some((time, index) => index > 0 && time < historyTimes[index - 1])) errors.push(`${application.id} có lịch sử không theo thời gian`)
    const lastActivityAt = application.lastNotification?.sentAt ?? historyTimes.at(-1)
    if (application.lastNotification && (!isValidDate(application.lastNotification.sentAt) || application.lastNotification.sentAt < application.appliedAt)) errors.push(`${application.id} có thông báo sai thời gian`)
    if (lastActivityAt && application.updatedAt < lastActivityAt) errors.push(`${application.id} có updatedAt trước hoạt động gần nhất`)
  }
  for (const bookmark of db.bookmarks) {
    const job = jobsById.get(bookmark.jobId)
    const candidate = usersById.get(bookmark.candidateId)
    if (!job || candidate?.role !== 'candidate' || !isValidDate(bookmark.createdAt)) errors.push(`${bookmark.id} không hợp lệ`)
    else if (bookmark.createdAt < job.createdAt || bookmark.createdAt < candidate.createdAt) errors.push(`${bookmark.id} được tạo quá sớm`)
  }
  for (const review of db.reviews) {
    const candidate = usersById.get(review.candidateId)
    const employer = usersById.get(review.employerId)
    if (candidate?.role !== 'candidate' || employer?.role !== 'employer' || review.rating < 1 || review.rating > 5 || !isValidDate(review.createdAt) || !isValidDate(review.updatedAt)) errors.push(`${review.id} không hợp lệ`)
    else if (review.createdAt < candidate.createdAt || review.createdAt < employer.createdAt || review.updatedAt < review.createdAt) errors.push(`${review.id} có thời gian không hợp lý`)
  }
  if (Array.isArray(db.companyFollows) && Array.isArray(db.notifications)) {
    try {
      validateCompanyEngagementData(db, { requireFollowRange: requirePlannedCounts })
    } catch (engagementError) {
      errors.push(engagementError instanceof Error ? engagementError.message : 'Dữ liệu theo dõi/thông báo không hợp lệ')
    }
  }
  try {
    validateAccountModerationData(db, { requireSeedDefaults: requirePlannedCounts })
  } catch (moderationError) {
    errors.push(moderationError instanceof Error ? moderationError.message : 'Dữ liệu kiểm duyệt không hợp lệ')
  }
  if (requirePlannedCounts) {
    const expected = { employers: 12, candidates: 240, jobs: 144, bookmarks: 1200, reviews: 320 }
    if (db.users.filter((user) => user.role === 'employer').length !== expected.employers) errors.push('Số Employer không đúng kế hoạch')
    if (db.users.filter((user) => user.role === 'candidate').length !== expected.candidates) errors.push('Số Candidate không đúng kế hoạch')
    if (db.jobs.length !== expected.jobs) errors.push('Số Job không đúng kế hoạch')
    if (db.applications.length < 1400 || db.applications.length > 1600) errors.push(`Số Application ${db.applications.length} ngoài khoảng 1400-1600`)
    if (db.bookmarks.length !== expected.bookmarks) errors.push('Số Bookmark không đúng kế hoạch')
    if (db.reviews.length !== expected.reviews) errors.push('Số Review không đúng kế hoạch')
    const plannedCounts = [
      ['trạng thái Job', { open: 90, closed: 42, draft: 12 }, Object.fromEntries(['open', 'closed', 'draft'].map((status) => [status, db.jobs.filter((job) => job.status === status).length]))],
      ['ngành nghề', categoryCounts, Object.fromEntries(Object.keys(categoryCounts).map((category) => [category, db.jobs.filter((job) => job.category === category).length]))],
      ['địa điểm', locationCounts, Object.fromEntries(Object.keys(locationCounts).map((location) => [location, db.jobs.filter((job) => job.location === location).length]))],
      ['loại việc', { 'full-time': 90, 'part-time': 20, internship: 18, contract: 16 }, Object.fromEntries(['full-time', 'part-time', 'internship', 'contract'].map((type) => [type, db.jobs.filter((job) => job.employmentType === type).length]))],
      ['hình thức làm việc', { 'on-site': 72, hybrid: 38, remote: 34 }, Object.fromEntries(['on-site', 'hybrid', 'remote'].map((type) => [type, db.jobs.filter((job) => job.workplaceType === type).length]))],
    ]
    for (const [label, planned, actual] of plannedCounts) {
      if (Object.entries(planned).some(([value, count]) => actual[value] !== count)) errors.push(`Phân bố ${label} không đúng kế hoạch`)
    }
    for (const company of companies) {
      if (db.jobs.filter((job) => job.employerId === company.id).length !== company.jobCount) errors.push(`Số Job của ${company.name} không đúng kế hoạch`)
    }
  }
  if (errors.length) throw new Error(`Dữ liệu không hợp lệ:\n- ${errors.slice(0, 30).join('\n- ')}`)
}

function printSummary(db, label) {
  const roleCounts = Object.fromEntries(['admin', 'employer', 'candidate'].map((role) => [role, db.users.filter((user) => user.role === role).length]))
  const jobStatuses = Object.fromEntries(['draft', 'open', 'closed'].map((status) => [status, db.jobs.filter((job) => job.status === status).length]))
  const applicationStatusCounts = Object.fromEntries(applicationStatuses.map((status) => [status, db.applications.filter((application) => application.status === status).length]))
  console.log(label)
  const engagementSummary = summarizeCompanyEngagementData(db)
  const moderationSummary = summarizeAccountModerationData(db)
  console.log(JSON.stringify({ users: db.users.length, roleCounts, jobs: db.jobs.length, jobStatuses, applications: db.applications.length, applicationStatusCounts, bookmarks: db.bookmarks.length, reviews: db.reviews.length, ...engagementSummary, ...moderationSummary }, null, 2))
}

if (checkOnly) {
  const currentDb = JSON.parse(readFileSync(dbPath, 'utf8'))
  // Dữ liệu sau khi người dùng test có thể tăng/giảm số bản ghi; chế độ check
  // chỉ xác minh schema, quan hệ và thời gian, không ép lại số lượng seed gốc.
  validateDb(currentDb, false)
  printSummary(currentDb, 'db.json hợp lệ')
} else if (dryRun) {
  validateDb(generatedDb, true)
  printSummary(generatedDb, 'Dry run bộ dữ liệu mock thành công; db.json chưa bị thay đổi')
} else {
  validateDb(generatedDb, true)
  if (!existsSync(backupPath) && existsSync(dbPath)) copyFileSync(dbPath, backupPath)
  writeFileSync(dbPath, `${JSON.stringify(generatedDb, null, 2)}\n`, 'utf8')
  printSummary(generatedDb, 'Đã tạo dữ liệu mock thành công')
  console.log(`Backup ban đầu: ${backupPath}`)
}
