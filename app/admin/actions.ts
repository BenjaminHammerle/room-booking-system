"use server";

import { createClient } from "@supabase/supabase-js";

// supabase admin client mit service role key für auth management
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// neuen benutzer erstellen
export async function createNewUserAdmin(userData: any) {
  try {
    // user im auth system anlegen
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { 
        first_name: userData.first_name, 
        last_name: userData.last_name 
      }
    });

    if (authError) return { error: authError.message };

    // profil in datenbank anlegen mit upsert (falls trigger schon profil angelegt hat)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.user.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        is_admin: userData.is_admin
      }, { onConflict: 'id' });

    if (profileError) return { error: profileError.message };
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// benutzer aktualisieren
export async function updateUserAdmin(userId: string, userData: any) {
  try {
    // auth email/passwort aktualisieren
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: userData.email,
      ...(userData.password && { password: userData.password })
    });

    if (authError) return { error: authError.message };

    // profildaten in db aktualisieren
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        is_admin: userData.is_admin
      })
      .eq("id", userId);

    if (profileError) return { error: profileError.message };
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}