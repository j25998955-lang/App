import { supabase } from './supabase-client.js';

// --- ELEMENTOS DEL DOM ---
const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const avatarInput = document.getElementById('avatar-upload');
const avatarPreview = document.getElementById('profile-avatar');
const smallAvatar = document.getElementById('profile-avatar-small');
const logoutBtn = document.getElementById('logout-btn');
const notification = document.getElementById('notification');

// --- URL de Placeholder Centralizada ---
const PLACEHOLDER_URL = 'https://via.placeholder.com/150/222C32/FFFFFF?Text=User';
const SMALL_PLACEHOLDER_URL = 'https://via.placeholder.com/40/222C32/FFFFFF?Text=A';

let currentUser = null;

// --- FUNCIÓN DE NOTIFICACIÓN ---
const showNotification = (message, isError = false) => {
    notification.textContent = message;
    notification.className = `notification ${isError ? 'is-error' : 'is-success'} show`;
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
};

// --- HELPER ROBUSTO PARA OBTENER URL DE IMAGEN ---
const getOptimizedUrl = (bucket, path, options) => {
    // Si la ruta no existe, o si ya es una URL completa (para datos antiguos o placeholders), la devuelve directamente.
    if (!path || path.startsWith('http')) {
        return path;
    }
    // Si es una ruta de archivo, solicita la URL pública transformada a Supabase.
    const { data } = supabase.storage.from(bucket).getPublicUrl(path, { transform: options });
    
    // Devuelve la URL pública o null si no se pudo generar.
    return data.publicUrl;
};

// --- FUNCIÓN PARA ACTUALIZAR AVATARES ---
const updateAvatarImages = (largeUrl, smallUrl) => {
    // Añade un timestamp para forzar la actualización de la caché del navegador.
    const timestamp = `?t=${new Date().getTime()}`;
    avatarPreview.src = largeUrl ? largeUrl + timestamp : PLACEHOLDER_URL;
    smallAvatar.src = smallUrl ? smallUrl + timestamp : SMALL_PLACEHOLDER_URL;
};

// --- FUNCIÓN PRINCIPAL CORREGIDA ---
const loadProfile = async () => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user;
        emailInput.value = user.email;
        
        const { data: profile, error: profileError, status } = await supabase
            .from('profiles')
            .select(`username, avatar_url`)
            .eq('id', user.id)
            .single();

        if (profileError && status !== 406) throw new Error(`Error al buscar perfil: ${profileError.message}`);

        if (profile) {
            usernameInput.value = profile.username || '';
            // Utiliza el helper robusto para obtener las URLs, sean antiguas o nuevas.
            const largeUrl = getOptimizedUrl('avatars', profile.avatar_url, { width: 200, height: 200, quality: 80 });
            const smallUrl = getOptimizedUrl('avatars', profile.avatar_url, { width: 80, height: 80, quality: 80 });
            updateAvatarImages(largeUrl, smallUrl);
        } else {
            // Si no hay perfil, usa los placeholders.
            updateAvatarImages(null, null);
        }

    } catch (error) {
        showNotification(`Error al cargar el perfil: ${error.message}`, true);
        updateAvatarImages(null, null); // Fallback a placeholders en caso de error.
    }
};

const handleProfileUpdate = async (event) => {
    event.preventDefault();
    const formButton = profileForm.querySelector('button[type="submit"]');
    formButton.disabled = true;
    formButton.textContent = 'Guardando...';

    try {
        const newAvatarFile = avatarInput.files[0];
        const { data: currentProfile } = await supabase.from('profiles').select('avatar_url').eq('id', currentUser.id).single();
        
        let avatarPathForDb = currentProfile ? currentProfile.avatar_url : null;

        if (newAvatarFile) {
            // Guarda siempre la nueva imagen como una RUTA, no como una URL completa.
            const newPath = `${currentUser.id}/${Date.now()}_${newAvatarFile.name}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(newPath, newAvatarFile, { upsert: true });
            if (uploadError) throw new Error(`Error en subida de imagen: ${uploadError.message}`);
            avatarPathForDb = newPath; 

            // Borra la imagen antigua del storage si existía y era una ruta (no una URL http).
            if (currentProfile && currentProfile.avatar_url && !currentProfile.avatar_url.startsWith('http')) {
                 const { error: removeError } = await supabase.storage.from('avatars').remove([currentProfile.avatar_url]);
                 if (removeError) console.error('Fallo al borrar el avatar antiguo:', removeError.message);
            }
        }

        const updates = {
            id: currentUser.id,
            username: usernameInput.value.trim(),
            updated_at: new Date(),
            avatar_url: avatarPathForDb, // Guarda la RUTA en la base de datos.
        };

        const { error: upsertError } = await supabase.from('profiles').upsert(updates);
        if (upsertError) throw new Error(`Error al guardar en base de datos: ${upsertError.message}`);
        
        // Actualiza el nombre de usuario en los metadatos de auth para consistencia.
        await supabase.auth.updateUser({ data: { username: updates.username } });

        await loadProfile();
        showNotification('¡Perfil actualizado con éxito!');

    } catch (error) {
        showNotification(`Error al actualizar: ${error.message}`, true);
        await loadProfile(); 
    } finally {
        formButton.disabled = false;
        formButton.textContent = 'Guardar Cambios';
    }
};

const showAvatarPreview = () => {
    const file = avatarInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            // La previsualización es local, no necesita optimización.
            avatarPreview.src = e.target.result;
            smallAvatar.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      showNotification(`Error al cerrar sesión: ${error.message}`, true);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if(profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
    if(avatarInput) avatarInput.addEventListener('change', showAvatarPreview);
    if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    loadProfile();
});