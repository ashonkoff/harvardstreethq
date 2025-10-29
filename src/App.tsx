import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Header } from './components/Header'
import { RequireAuth } from './components/RequireAuth'
import { Dashboard } from './components/Dashboard'
import { Notes } from './components/Notes'
import { Tasks } from './components/Tasks'
import { Subscriptions } from './components/Subscriptions'
import { Calendar } from './components/Calendar'
import { MealPlan } from './components/MealPlan'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'notes' | 'subscriptions' | 'calendar' | 'mealplan'>('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  function renderContent() {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />
      case 'tasks':
        return <Tasks session={session} />
      case 'notes':
        return <Notes />
      case 'subscriptions':
        return <Subscriptions />
            case 'calendar':
              return <Calendar session={session} />
      case 'mealplan':
        return <MealPlan session={session} />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="container">
      <Header session={session} />
      <RequireAuth session={session}>
        {/* Navigation Tabs */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row" style={{ gap: 8 }}>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              📊 Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('tasks')}
              className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
            >
              📋 Tasks
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`nav-tab ${activeTab === 'notes' ? 'active' : ''}`}
            >
              📝 Notes
            </button>
            <button 
              onClick={() => setActiveTab('subscriptions')}
              className={`nav-tab ${activeTab === 'subscriptions' ? 'active' : ''}`}
            >
              💳 Subscriptions
            </button>
            <button 
              onClick={() => setActiveTab('calendar')}
              className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`}
            >
              📅 Calendar
            </button>
            <button 
              onClick={() => setActiveTab('mealplan')}
              className={`nav-tab ${activeTab === 'mealplan' ? 'active' : ''}`}
            >
              🍽️ Meal Plan
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="card">
          {renderContent()}
        </div>
      </RequireAuth>
    </div>
  )
}
