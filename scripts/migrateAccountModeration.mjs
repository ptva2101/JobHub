import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addAccountModerationDefaults,
  summarizeAccountModerationData,
  validateAccountModerationData,
} from './accountModerationData.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultDbPath = resolve(projectRoot, 'db.json')
const backupPath = resolve(projectRoot, 'db.before-account-moderation.json')
const args = process.argv.slice(2)

function argumentValue(name) {
  const index = args.indexOf(name)
  if (index < 0) return null
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} cần một đường dẫn.`)
  return resolve(process.cwd(), value)
}

const inputPath = argumentValue('--input') ?? defaultDbPath
const outputPath = argumentValue('--output') ?? inputPath
const checkOnly = args.includes('--check')
const shouldWrite = args.includes('--write')

if (checkOnly && shouldWrite) {
  throw new Error('Không thể dùng đồng thời --check và --write.')
}
if (!existsSync(inputPath)) throw new Error(`Không tìm thấy file dữ liệu: ${inputPath}`)

const sourceDb = JSON.parse(readFileSync(inputPath, 'utf8'))

if (checkOnly) {
  validateAccountModerationData(sourceDb)
  console.log('Dữ liệu kiểm duyệt tài khoản và tin tuyển dụng hợp lệ.')
  console.log(JSON.stringify(summarizeAccountModerationData(sourceDb), null, 2))
} else {
  const migratedDb = addAccountModerationDefaults(sourceDb)
  validateAccountModerationData(migratedDb, { requireSeedDefaults: true })
  const summary = summarizeAccountModerationData(migratedDb)

  if (shouldWrite) {
    if (inputPath === defaultDbPath && outputPath === defaultDbPath && !existsSync(backupPath)) {
      copyFileSync(defaultDbPath, backupPath)
    }
    const temporaryPath = `${outputPath}.tmp-account-moderation`
    writeFileSync(temporaryPath, `${JSON.stringify(migratedDb, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, outputPath)
    console.log(`Đã migration dữ liệu kiểm duyệt vào: ${outputPath}`)
    if (outputPath === defaultDbPath) console.log(`Backup trước migration: ${backupPath}`)
  } else {
    console.log('Dry run thành công; db.json chưa bị thay đổi.')
    console.log('Dùng --write để xác nhận ghi dữ liệu.')
  }

  console.log(JSON.stringify(summary, null, 2))
}
