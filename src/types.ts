export type Note = {
  id: string
  content: string
  category: string
  tags: string[]
  created_at: string
}

export type Task = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  created_at: string
}

export type Subscription = {
  id: string
  name: string
  amount_cents: number
  cadence: 'monthly' | 'yearly'
  category: string
  next_renewal_date: string | null
  is_active: boolean
  created_at: string
}
