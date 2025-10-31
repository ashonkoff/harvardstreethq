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
import { Sports } from './components/Sports'
import { School } from './components/School'
import { House } from './components/House'
import { Car } from './components/Car'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tasks' | 'notes' | 'subscriptions' | 'calendar' | 'mealplan' | 'sports' | 'school' | 'house' | 'car'>('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  function renderContent() {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard session={session} onNavigate={(tab) => setActiveTab(tab as any)} />
      case 'tasks':
        return <Tasks session={session} />
      case 'notes':
        return <Notes />
      case 'subscriptions':
        return <Subscriptions />
            case 'calendar':
              return <Calendar session={session} />
      case 'mealplan':
        return <MealPlan />
      case 'sports':
        return <Sports />
      case 'school':
        return <School />
      case 'house':
        return <House />
      case 'car':
        return <Car />
      default:
        return <Dashboard session={session} onNavigate={(tab) => setActiveTab(tab as any)} />
    }
  }

  return (
    <div className="container">
      <Header session={session} />
      <RequireAuth session={session}>
        <div className="app-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Left Sidebar Navigation */}
          <div className="sidebar-nav card" style={{ width: 220, padding: 12, position: 'sticky', top: 0, flexShrink: 0 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`nav-sidebar-item nav-sidebar-dashboard ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                🏠 Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('calendar')}
                className={`nav-sidebar-item ${activeTab === 'calendar' ? 'active' : ''}`}
              >
                📅 Calendar
              </button>
              <button 
                onClick={() => setActiveTab('tasks')}
                className={`nav-sidebar-item ${activeTab === 'tasks' ? 'active' : ''}`}
              >
                ✅ To do
              </button>
              <button 
                onClick={() => setActiveTab('mealplan')}
                className={`nav-sidebar-item ${activeTab === 'mealplan' ? 'active' : ''}`}
              >
                🍽️ Meal Plan
              </button>
              <button 
                onClick={() => setActiveTab('notes')}
                className={`nav-sidebar-item ${activeTab === 'notes' ? 'active' : ''}`}
              >
                📝 Notes
              </button>
              <button 
                onClick={() => setActiveTab('sports')}
                className={`nav-sidebar-item ${activeTab === 'sports' ? 'active' : ''}`}
              >
                🏃 Sports
              </button>
              <button 
                onClick={() => setActiveTab('school')}
                className={`nav-sidebar-item ${activeTab === 'school' ? 'active' : ''}`}
              >
                📚 School
              </button>
              <button 
                onClick={() => setActiveTab('house')}
                className={`nav-sidebar-item ${activeTab === 'house' ? 'active' : ''}`}
              >
                🏠 House
              </button>
              <button 
                onClick={() => setActiveTab('car')}
                className={`nav-sidebar-item ${activeTab === 'car' ? 'active' : ''}`}
              >
                🚗 Car
              </button>
              <button 
                onClick={() => setActiveTab('subscriptions')}
                className={`nav-sidebar-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
              >
                💳 Subscriptions
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeTab === 'dashboard' ? (
              renderContent()
            ) : (
              <div className="card">
                {renderContent()}
              </div>
            )}
          </div>
        </div>
      </RequireAuth>
    </div>
  )
}
