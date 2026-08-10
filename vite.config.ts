import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // json-server ghi lại file này sau mỗi POST/PATCH/DELETE. Không để Vite
    // xem đó là thay đổi mã nguồn và tải lại toàn bộ trang.
    watch: {
      ignored: ['**/db.json'],
    },
  },
})
