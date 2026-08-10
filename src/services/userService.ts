import type { User } from '../types/user'
import { apiClient } from './apiClient'

export const userService = {
  getAll: () => apiClient.get<User[]>('/users'),
  getById: (id: string) => apiClient.get<User>(`/users/${id}`),
  update: (id: string, payload: Partial<User>) =>
    apiClient.patch<User>(`/users/${id}`, {
      ...payload,
      updatedAt: new Date().toISOString(),
    }),
}
