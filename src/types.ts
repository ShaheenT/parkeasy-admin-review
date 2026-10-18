export type Row = { id: string | number; status?: string; [k: string]: string | number | undefined }
export type User = { id: string; name: string; email: string; role: 'admin' | 'support' }
export type Range = 'day' | 'week' | 'month'
export type Integration = { id: string; name: string; description: string; connected: boolean; config?: string }
