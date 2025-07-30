import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateToken } from '../utils/generateToken.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

///////Helper functions

const sendResetEmail = async (to, link) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"Guru Innovation tasks" <${process.env.EMAIL_FROM}>`,
    to,
    subject: 'Password Reset Request',
    html: `
  <div style="max-width: 600px; margin: auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; padding: 24px; border-radius: 12px; border: 1px solid #e0e0e0;">
    <h2 style="color: #1D4ED8; margin-top: 0;">Guru Tasks – Password Reset</h2>

    <p style="font-size: 15px; color: #333;">
      You recently requested to reset your <strong>Guru Tasks</strong> password.
      Click the button below to set a new one. <br />
      <span style="color: #DC2626;"><strong>Note:</strong> This link expires in 15 minutes.</span>
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${link}" style="
        background-color: #1D4ED8;
        color: #FFFFFF;
        padding: 14px 28px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
        font-size: 16px;
        display: inline-block;
      ">
        Reset Your Password
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">
      If you didn’t request this, you can safely ignore this message.
      Your password will remain unchanged.
    </p>

    <hr style="margin: 40px 0; border: none; border-top: 1px solid #ccc;" />

    <p style="font-size: 13px; color: #999; text-align: center;">
      Powered by <strong>Guru Innovation Tasks</strong> • <a style="color: #1D4ED8;" href="https://guru.tasks">guru.tasks</a>
      <br />
      This is an automated message. Please do not reply.
    </p>
  </div>
`

  };

  await transporter.sendMail(mailOptions);
};

// 🧠 Reusable function to fetch/create role
 const getOrCreateRoleId = async (roleName) => {
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

////////////////////////////////////////////////////////////////////////////////////

// 🛡 Signup controller
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const profile_pic = req.file?.path || null;

    // 1. Check email exists (short-circuit fail early)
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) return res.status(400).json({ message: 'Email already in use' });

    // 2. Get or create role_id
    const role_id = await getOrCreateRoleId(role);

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, role_id, profile_pic }])
      .select(`
        id,
        name,
        email,
        access_role,
        suspended,
        profile_pic,
        user_roles (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;

    // 5. Generate token & respond
    const token = generateToken(user.id);
    res.status(201).json({ user, token });

  } catch (err) {
    console.error('Signup Error:', err.message);
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
};


//login
export const login = async (req, res) => {
  const { email, password } = req.body;
  // console.log(req.body)

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) return res.status(401).json({ message: 'Invalid credentials' });

  const validPass = await bcrypt.compare(password, user.password);
  if (!validPass) return res.status(401).json({ message: 'Invalid credentials' });

  const token = generateToken(user.id);
  res.json({ user, token });
};


// 🚨 1. Forgot Password
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  // Check if user exists
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user || error) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Generate token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 mins

  // Save token in DB
  const { error: updateError } = await supabase
    .from('users')
    .update({
      reset_token: resetToken,
      reset_token_expires_at: expiresAt.toISOString()
    })
    .eq('email', email);

  if (updateError) {
    return res.status(500).json({ message: 'Failed to store reset token' });
  }

  // Send Email (via nodemailer or 3rd party)
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  await sendResetEmail(email, resetUrl); // 👇 Helper below

  res.json({ message: 'Password reset link sent if email exists' });
};

// 🚀 2. Reset Password Handler
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('reset_token', token)
    .single();

  if (error || !user || new Date(user.reset_token_expires_at) < new Date()) {
    return res.status(400).json({ message: 'Token is invalid or expired' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      password: hashed,
      reset_token: null,
      reset_token_expires_at: null
    })
    .eq('id', user.id);

  if (updateError) {
    return res.status(500).json({ message: 'Failed to reset password' });
  }

  res.json({ message: 'Password reset successful' });
};