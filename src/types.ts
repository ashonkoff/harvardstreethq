export type Note = {
  id: string
  content: string
  created_at: string
}

export type Task = {
  id: string
  title: string
  status: 'todo' | 'doing' | 'done'
  due_date: string | null
  created_at: string
}

export type Subscription = {
  id: string
  name: string
  amount_cents: number
  cadence: 'monthly' | 'yearly'
  next_renewal_date: string | null
  created_at: string
}
