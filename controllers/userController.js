import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

//helper function

export const getOrCreateRoleId = async (roleName) => {
  const { data: role, error: roleFetchError } = await supabase
    .from('user_roles')
    .select('id')
    .eq('name', roleName)
    .maybeSingle(); // ✅ Avoid .single() crash

  if (role) return role.id;

  const { data: newRole, error: roleInsertError } = await supabase
    .from('user_roles')
    .insert([{ name: roleName }])
    .select('id')
    .single();

  if (roleInsertError) throw new Error('Role creation failed');
  return newRole.id;
};

/////

// ✅ Get all users
export const getAllUsers = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
    id,
    name,
    email,
    suspended,
    access_role,
    profile_pic,
    user_roles (
      id,
      name
    ),
    project_members (
      project_id,
      projects (
        id,
        name,
        description,
        image,
        status_id,
        priority,
        created_at
      )
    ),
    tasks (
      id,
      name,
      project_id,
      status_id,
      tags,
      created_at,
      due_date
    )
  `);


  if (error) return res.status(500).json({ message: 'Failed to fetch users', error });

  res.json(data);
};

// ✅ Get single user
export const getUserById = async (req, res) => {
  console.log(req.params.id)
  const { id } = req.params.id == 'me' ? req.user : req.params;

  const { data, error } = await supabase
    .from('users')
    .select(`
    id,
    name,
    email,
    suspended,
    access_role,
    profile_pic,
    user_roles (
      id,
      name
    ),
    project_members (
      project_id,
      projects (
        id,
        name,
        description,
        image,
        status_id,
        priority,
        created_at
      )
    ),
    tasks (
      id,
      name,
      project_id,
      status_id,
      tags,
      created_at,
      due_date
    )
  `)
    .eq('id', id)
    .single();


  if (error) return res.status(404).json({ message: 'User not found', error });

  res.json(data);
};

// ✅ Update user (name, suspended, role_id, etc.)
export const updateUser = async (req, res) => {
  const { id } = req.params;
  console.log(id)
  const { name, email, role } = req.body;
  const profile_pic = req.file?.path || null;
  console.log(name, email, role, profile_pic)


  const role_id = await getOrCreateRoleId(role);
  let uploadData = { name, email, role_id, profile_pic }
  if (!profile_pic) uploadData = { name, email, role_id }
  const { data, error } = await supabase
    .from('users')
    .update(uploadData)
    .eq('id', id)
    .select(`
    id,
    name,
    email,
    suspended,
    access_role,
    profile_pic,
    user_roles (
      id,
      name
    ),
    project_members (
      project_id,
      projects (
        id,
        name,
        description,
        image,
        status_id,
        priority,
        created_at
      )
    ),
    tasks (
      id,
      name,
      project_id,
      status_id,
      tags,
      created_at,
      due_date
    )
  `)
    .single();

  if (error) return res.status(400).json({ message: 'Update failed', error });

  res.json({ message: 'User updated successfully', user: data });
};

// ✅ Delete user (hard delete)
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ message: 'Failed to delete user', error });

  res.json({ message: 'User deleted successfully' });
};

// ✅ Suspend or Unsuspend user
export const suspendUser = async (req, res) => {
  const { id } = req.params;
  const { suspended } = req.body;

  if (typeof suspended !== 'boolean') {
    return res.status(400).json({ message: "'suspended' must be true or false" });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ suspended })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ message: 'Failed to update suspension status', error });
  }

  const action = suspended ? 'suspended' : 'reinstated';
  res.json({ message: `User ${action} successfully`, user: data });
};

