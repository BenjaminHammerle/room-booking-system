'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! //
)

export async function updateUserAdmin(id: string, data: { email?: string, first_name?: string, last_name?: string, is_admin?: boolean }) {
  // 1. Auth-Daten (E-Mail) aktualisieren
  if (data.email) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { email: data.email });
    if (authError) throw authError;
  }

  // 2. Profil-Daten aktualisieren
  const { error: profError } = await supabaseAdmin
    .from('profiles')
    .update({ 
      first_name: data.first_name, 
      last_name: data.last_name, 
      is_admin: data.is_admin,
      email: data.email //
    })
    .eq('id', id);

  if (profError) throw profError;
  
  revalidatePath('/admin');
  return { success: true };
}

export async function createNewUserAdmin(data: any) {
  // 1. User in Auth anlegen
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { 
      first_name: data.first_name, 
      last_name: data.last_name,
      is_admin: data.is_admin 
    }
  });

  // Falls der Auth-User schon existiert, fangen wir das hier ab
  if (authError) throw authError;

  // 2. Profil in der Datenbank anlegen (mit UPSERT statt INSERT)
  if (authData.user) {
    const { error: profError } = await supabaseAdmin
      .from('profiles')
      .upsert([ // <--- KORREKTUR: upsert statt insert
        {
          id: authData.user.id,
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          is_admin: data.is_admin
        }
      ], { onConflict: 'id' }); // Sagt der DB: Bei ID-Konflikt einfach überschreiben

    if (profError) throw profError;
  }

  revalidatePath('/admin');
  return { success: true };
}