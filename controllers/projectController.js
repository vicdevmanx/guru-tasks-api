import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 🚀 CREATE
export const createProject = async (req, res) => {
  try {
    //for further enhancement you can add status_id, priority, aka vicdevmanx was here
    const { name, description, notifications, member_ids } = req.body;
    const owner_id = req.user.id;
    console.log(req.body)
    let image = null;
    if (req.file?.path) {
      image = req.file.path;
    }


    const { data: project, error } = await supabase
      .from('projects')
      .insert([
        {
          name,
          description,
          image,
          owner_id,
          notifications
        }
      ])
      .select(`
    *,
    project_members (
      *,
      user:users (
        id,
        name,
        email,
        profile_pic,
        user_roles (
          id,
          name
        )
      )
    ),
    tasks ( *,
      status:task_statuses (id, name),
    assignees:users (id, name, email, profile_pic),
    project:projects (id, name) )
  `)
      .single();

    const formattedProject = {
      ...project,
      tasks: (project?.tasks ?? []).map(task => ({
        id: task.id,
        title: task.name,
        description: task.description ?? undefined,
        status: task.status?.name ?? 'unknown',
        priority: "medium", // default or inferred
        assignees: task.assignee ? [{
          id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          profile_pic: task.assignee.profile_pic
        }] : [],
        createdAt: new Date(task.created_at),
        due_date: task.due_date ? new Date(task.due_date) : undefined
      }))
    };


    if (error) throw error;


    // Add owner as member (optional) + other members
    const memberEntries = JSON.parse(member_ids)?.map(user_id => ({
      project_id: project.id,
      user_id
    })) || [];

    // memberEntries.push({ project_id: project.id, user_id: owner_id }); // owner role

    await supabase.from('project_members').insert(memberEntries);

    res.status(201).json({ message: 'Project created', project: formattedProject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create project', error: err.message });
  }
};

// 🚀 GET PROJECTS
export const getProjects = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
    *,
    project_members (
      *,
      user:users (
        id,
        name,
        email,
        profile_pic,
        user_roles (
          id,
          name
        )
      )
    ),
    tasks ( 
      *,
      status:task_statuses (id, name),
      assignee:users (id, name, email, profile_pic)
    )
  `);

    const formattedProjects = projects?.map(project => {
      return {
        ...project,
        tasks: (project.tasks ?? []).map(task => ({
          id: task.id,
          title: task.name,
          description: task.description ?? undefined,
          status: task.status?.name ?? 'unknown',
          priority: "medium", // or however you want to derive it
          assignees: task.assignee ? [{
            id: task.assignee.id,
            name: task.assignee.name,
            email: task.assignee.email,
            profile_pic: task.assignee.profile_pic
          }] : [],
          createdAt: new Date(task.created_at),
          due_date: task.due_date ? new Date(task.due_date) : undefined
        }))
      };
    });



    if (error) throw error;

    res.json(formattedProjects);
  } catch (err) {
    res.status(500).json({ message: 'Could not load projects', error: err.message });
  }
};

// 🚀 GET PROJECTS BY ID
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: project, error } = await supabase
      .from('projects')
      .select(`
    *,
    project_members (
      *,
      user:users (
        id,
        name,
        email,
        profile_pic,
        user_roles (
          id,
          name
        )
      )
    ),
    tasks (
      *,
      status:task_statuses (id, name),
      assignee:users (id, name, email, profile_pic)
    )
  `)
      .eq('id', id)
      .single();


    const formattedProject = {
      ...project,
      tasks: (project?.tasks ?? []).map(task => ({
        id: task.id,
        title: task.name, // Supabase column is `name`
        description: task.description ?? undefined,
        status: task.status?.name ?? 'unknown',
        priority: "medium", // or "low" | "high" if you store priority
        assignees: task.assignee ? [{
          id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          profile_pic: task.assignee.profile_pic
        }] : [],
        createdAt: new Date(task.created_at),
        due_date: task.due_date ? new Date(task.due_date) : undefined
      }))
    };

    if (error || !project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(formattedProject);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch project', error: err.message });
  }
};

// 🚀 UPDATE PROJECTS
export const updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status_id, priority, notifications, member_ids } = req.body;

    // Build the updates object
    const updates = { name, description, status_id, priority, notifications };

    // If there’s a new image, add it
    if (req.file?.path) {
      updates.image = req.file.path;
    }

    // Update project with new data
    const { data: project, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        project_members (
          *,
          user:users (
            id,
            name,
            email,
            profile_pic,
            user_roles (
              id,
              name
            )
          )
        ),
        tasks (
          *,
          status:task_statuses (id, name),
          assignee:users (id, name, email, profile_pic),
          project:projects (id, name)
        )
      `)
      .single();

    if (error) throw error;

    // Format just like your createProject
    const formattedProject = {
      ...project,
      tasks: (project?.tasks ?? []).map(task => ({
        id: task.id,
        title: task.name,
        description: task.description ?? undefined,
        status: task.status?.name ?? 'unknown',
        priority: "medium", // or task.priority if you store it
        assignees: task.assignee ? [{
          id: task.assignee.id,
          name: task.assignee.name,
          email: task.assignee.email,
          profile_pic: task.assignee.profile_pic
        }] : [],
        createdAt: new Date(task.created_at),
        due_date: task.due_date ? new Date(task.due_date) : undefined
      }))
    };

    // Optional: Update members if sent
    if (member_ids) {
      // Clear existing members for this project (optional!)
      await supabase.from('project_members').delete().eq('project_id', id);

      const memberEntries = JSON.parse(member_ids)?.map(user_id => ({
        project_id: id,
        user_id
      })) || [];

      await supabase.from('project_members').insert(memberEntries);
    }

    res.json({ message: 'Project updated', project: formattedProject });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Update failed', error: err.message });
  }
};


// 🚀 DELETE PROJECTS
export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete project', error: err.message });
  }
};

// 🚀 assign user to project
export const assignUserToProject = async (req, res) => {
  try {
    const { id: project_id } = req.params;
    const { user_id, role_id } = req.body;

    const { error } = await supabase.from('project_members').insert({
      project_id,
      user_id,
      role_id: role_id || 4 // default: member
    });

    if (error) throw error;

    res.json({ message: 'User assigned to project' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to assign user', error: err.message });
  }
};
