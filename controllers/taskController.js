import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// helpers/status.ts
export const getOrCreateStatusId = async (statusName) => {
  // First, try to find existing
  const { data: existing, error: selectError } = await supabase
    .from('task_statuses') // your task_statuses table
    .select('id')
    .eq('name', statusName)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // ignore row not found
    throw new Error(`Failed to fetch status: ${selectError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  // Not found — create it
  const { data: inserted, error: insertError } = await supabase
    .from('task_statuses')
    .insert([{ name: statusName }])
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to create status: ${insertError.message}`);
  }

  return inserted.id;
};


// ✅ Create Task

export const createTask = async (req, res) => {
  try {
    const {
      project_id,
      name,
      description,
      assignee_id,
      status, // this is the text from frontend
      tags,
      due_date,
    } = req.body;

    if (!project_id || !name || !status) {
      return res.status(400).json({
        message: 'Project ID, name, and status are required',
      });
    }

    // 🔥 Resolve or create status ID
    const status_id = await getOrCreateStatusId(status);

    const { data, error } = await supabase
      .from('tasks')
      .insert([
        {
          project_id,
          name,
          description,
          assignee_id,
          status_id, // your DB wants this
          tags,
          due_date,
        },
      ])
      .select(`
    *,
    status:task_statuses (id, name),
    assignee:users (id, name, email, profile_pic),
    project:projects (id, name)
  `)
      .single();

    const newTask = {
      id: data.id,
      title: data.name, // assuming `name` is your task title
      description: data.description ?? undefined,
      status: data.status?.name ?? 'unknown', // fallback if join failed
      priority: "medium", // default or derive if you store it elsewhere
      assignees: [
        {
          id: data.assignee?.id,
          name: data.assignee?.name,
          email: data.assignee?.email,
          profile_pic: data.assignee?.profile_pic,
        },
      ],
      createdAt: new Date(data.created_at), // supabase auto timestamp?
      due_date: data.due_date ? new Date(data.due_date) : undefined,
    };


    if (error) throw error;

    res.status(201).json({ message: 'Task created', task: newTask });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: 'Failed to create task', error: err.message });
  }
};

// ✅ Get All Tasks (optionally filter by project_id)
export const getTasks = async (req, res) => {
  const { project_id } = req.query;

  let query = supabase
    .from('tasks')
    .select(`
      id, name, description, status_id, tags, created_at, due_date,
      assignee:assignee_id ( id, name, profile_pic ),
      project:project_id ( id, name )
    `);

  if (project_id) query = query.eq('project_id', project_id);

  const { data, error } = await query;

  if (error) return res.status(500).json({ message: 'Failed to fetch tasks', error });

  res.json(data);
};

// ✅ Update Task
export const updateTask = async (req, res) => {
  const { id } = req.params;
  const { name, description, status_id, tags, assignee_id, due_date } = req.body;

  const { data, error } = await supabase
    .from('tasks')
    .update({ name, description, status_id, tags, assignee_id, due_date })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ message: 'Update failed', error });

  res.json({ message: 'Task updated', task: data });
};


// ✅ Update Task Status
export const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params; // task ID
    const { status } = req.body; // new status text

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    // Get or create status_id
    const status_id = await getOrCreateStatusId(status);

    // Just update, no select needed
    const { error } = await supabase
      .from('tasks')
      .update({ status_id })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ message: 'Failed to update task status', error });
    }

    res.json({ message: 'Task status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};


// ✅ Delete Task
export const deleteTask = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) return res.status(400).json({ message: 'Delete failed', error });

  res.json({ message: 'Task deleted successfully' });
};


