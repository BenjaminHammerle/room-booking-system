"use server"; // Zwingend erforderlich für Next.js Server Actions

import { createClient } from "@supabase/supabase-js";

// HEILIGES GEBOT: Nutze den Service_Role_Key für Admin-Aktionen (Auth-Management)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Dieser Key darf NIEMALS im Frontend landen!
);

export async function createNewUserAdmin(userData: any) {
  try {
    // 1. User im Supabase Auth-System anlegen
    // Dies generiert die neue UUID
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

    // 2. HEILIGES GEBOT: Nutze UPSERT statt INSERT
    // Wir nehmen die UUID von oben (authUser.user.id).
    // Falls der DB-Trigger das Profil bereits angelegt hat, überschreiben wir es einfach.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: authUser.user.id, // Die vom System vergebene UUID
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        is_admin: userData.is_admin
      }, { onConflict: 'id' }); // Verhindert den PKEY-Fehler!

    if (profileError) return { error: profileError.message };
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateUserAdmin(userId: string, userData: any) {
  try {
    // 1. Auth-Email/Passwort aktualisieren (falls nötig)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: userData.email,
      // Passwort nur ändern wenn ein neues mitgegeben wurde
      ...(userData.password && { password: userData.password })
    });

    if (authError) return { error: authError.message };

    // 2. Profildaten in DB aktualisieren
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