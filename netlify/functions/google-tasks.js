import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey })
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { action, googleAccessToken, taskListId, taskId, taskData } = body

    if (!action) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'action is required' }),
      }
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No valid authorization header' }),
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid token' }),
      }
    }

    if (!googleAccessToken) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'googleAccessToken is required' }),
      }
    }

    // Get task lists
    if (action === 'listTaskLists') {
      const resp = await fetch('https://www.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Accept': 'application/json' },
      })
      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google Task Lists error:', resp.status, errorText)
        let errorMsg = 'Failed to fetch task lists'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error?.message || errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        return {
          statusCode: resp.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: errorMsg, details: errorText }),
        }
      }
      const data = await resp.json()
      const lists = (data.items || []).map((list) => ({
        id: list.id,
        title: list.title,
        updated: list.updated,
      }))
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ taskLists: lists }),
      }
    }

    // Get tasks from a list
    if (action === 'listTasks') {
      if (!taskListId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'taskListId is required' }),
        }
      }

      // Use '@default' as the default task list if not provided
      const listId = taskListId === '@default' ? '@default' : taskListId
      const resp = await fetch(`https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks?showCompleted=true&showHidden=true`, {
        headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Accept': 'application/json' },
      })
      
      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google Tasks error:', resp.status, errorText)
        let errorMsg = 'Failed to fetch tasks'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error?.message || errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        return {
          statusCode: resp.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: errorMsg, details: errorText }),
        }
      }

      const data = await resp.json()
      const tasks = (data.items || []).map((task) => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        status: task.status === 'completed' ? 'completed' : 'needsAction',
        due: task.due,
        completed: task.completed,
        updated: task.updated,
        position: task.position,
        taskListId: listId,
      }))

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ tasks }),
      }
    }

    // Create a new task
    if (action === 'createTask') {
      if (!taskListId || !taskData) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'taskListId and taskData are required' }),
        }
      }

      const listId = taskListId === '@default' ? '@default' : taskListId
      const taskPayload = {
        title: taskData.title,
        notes: taskData.notes || '',
      }

      if (taskData.due) {
        taskPayload.due = taskData.due
      }

      const resp = await fetch(`https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(taskPayload),
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google Create Task error:', resp.status, errorText)
        let errorMsg = 'Failed to create task'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error?.message || errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        return {
          statusCode: resp.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: errorMsg, details: errorText }),
        }
      }

      const task = await resp.json()
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          task: {
            id: task.id,
            title: task.title,
            notes: task.notes,
            status: task.status === 'completed' ? 'completed' : 'needsAction',
            due: task.due,
            completed: task.completed,
            updated: task.updated,
            position: task.position,
            taskListId: listId,
          },
        }),
      }
    }

    // Update a task (mark complete/incomplete or update title)
    if (action === 'updateTask') {
      if (!taskListId || !taskId || !taskData) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'taskListId, taskId, and taskData are required' }),
        }
      }

      const listId = taskListId === '@default' ? '@default' : taskListId
      const taskPayload = {}

      if (taskData.title !== undefined) taskPayload.title = taskData.title
      if (taskData.status !== undefined) taskPayload.status = taskData.status === 'completed' ? 'completed' : 'needsAction'
      if (taskData.notes !== undefined) taskPayload.notes = taskData.notes
      if (taskData.due !== undefined) taskPayload.due = taskData.due

      const resp = await fetch(`https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(taskPayload),
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google Update Task error:', resp.status, errorText)
        let errorMsg = 'Failed to update task'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error?.message || errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        return {
          statusCode: resp.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: errorMsg, details: errorText }),
        }
      }

      const task = await resp.json()
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          task: {
            id: task.id,
            title: task.title,
            notes: task.notes,
            status: task.status === 'completed' ? 'completed' : 'needsAction',
            due: task.due,
            completed: task.completed,
            updated: task.updated,
            position: task.position,
            taskListId: listId,
          },
        }),
      }
    }

    // Delete a task
    if (action === 'deleteTask') {
      if (!taskListId || !taskId) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'taskListId and taskId are required' }),
        }
      }

      const listId = taskListId === '@default' ? '@default' : taskListId
      const resp = await fetch(`https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Accept': 'application/json',
        },
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google Delete Task error:', resp.status, errorText)
        let errorMsg = 'Failed to delete task'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error?.message || errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        return {
          statusCode: resp.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: errorMsg, details: errorText }),
        }
      }

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ success: true }),
      }
    }

    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Unknown action' }),
    }

  } catch (error) {
    console.error('Google Tasks API error:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    }
  }
}

