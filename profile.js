import { supabase } from './supabase-client.js';

// --- ELEMENTOS DEL DOM ---
const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const avatarInput = document.getElementById('avatar-upload');
const avatarPreview = document.getElementById('avatar-preview');
const logoutBtn = document.getElementById('logout-btn');
const notification = document.getElementById('notification');

let currentUser = null;

// --- FUNCIÓN DE NOTIFICACIÓN ---
const showNotification = (message, isError = false) => {
    notification.textContent = message;
    notification.style.backgroundColor = isError ? 'var(--danger-color, #dc3545)' : 'var(--success-color, #28a745)';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
};

// --- FUNCIONES PRINCIPALES ---

const loadProfile = async () => {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(`Error de Autenticación: ${authError.message}`);
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = user;

        const { data: profile, error: profileError, status } = await supabase
            .from('profiles')
            .select(`username, avatar_url`)
            .eq('id', user.id)
            .single();

        if (profileError && status !== 406) {
            throw new Error(`Error al buscar perfil: ${profileError.message}`);
        }

        if (profile) {
            usernameInput.value = profile.username || '';
            if (profile.avatar_url) {
                 avatarPreview.src = `${profile.avatar_url}?t=${new Date().getTime()}`;
            } 
        } else {
             usernameInput.placeholder = "Define tu nombre de usuario";
        }

    } catch (error) {
        showNotification(`Error al cargar el perfil: ${error.message}`, true);
    }
};

const handleProfileUpdate = async (event) => {
    event.preventDefault();
    const formButton = profileForm.querySelector('button[type="submit"]');
    formButton.disabled = true;
    formButton.textContent = 'Guardando...';

    let oldAvatarPath = null;
    const newAvatarFile = avatarInput.files[0];

    try {
        // SOLO SI SE CAMBIA LA FOTO, obtener la ruta de la foto antigua para borrarla después.
        if (newAvatarFile) {
            const { data: currentProfile, error: profileError } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', currentUser.id)
                .single();

            if (profileError) {
                console.warn('No se pudo obtener la URL del avatar antiguo para borrarlo.', profileError.message);
            } else if (currentProfile && currentProfile.avatar_url) {
                // Extraemos la ruta del archivo desde la URL completa.
                const urlParts = currentProfile.avatar_url.split('/avatars/');
                if (urlParts.length > 1) {
                    oldAvatarPath = decodeURIComponent(urlParts[1]);
                }
            }
        }

        let newAvatarUrl = null;
        // Si hay un nuevo archivo de avatar, subirlo.
        if (newAvatarFile) {
            const filePath = `${currentUser.id}/${Date.now()}_${newAvatarFile.name}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, newAvatarFile, { upsert: true });

            if (uploadError) throw new Error(`Error en subida de imagen: ${uploadError.message}`);

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            newAvatarUrl = urlData.publicUrl;
        }

        // Preparar la actualización del perfil.
        const updates = {
            id: currentUser.id,
            username: usernameInput.value.trim(),
            updated_at: new Date(),
        };
        if (newAvatarUrl) {
            updates.avatar_url = newAvatarUrl;
        }

        // Actualizar el perfil en la base de datos.
        const { error: upsertError } = await supabase.from('profiles').upsert(updates);
        if (upsertError) throw new Error(`Error al guardar en base de datos: ${upsertError.message}`);

        // SI LA ACTUALIZACIÓN FUE EXITOSA, proceder a borrar el avatar antiguo.
        if (oldAvatarPath) {
            const { error: removeError } = await supabase.storage.from('avatars').remove([oldAvatarPath]);
            if (removeError) {
                // No mostramos este error al usuario, pero lo registramos en la consola.
                console.error('Fallo al borrar el avatar antiguo:', removeError.message);
            }
        }

        // Notificar al usuario del éxito.
        showNotification('¡Perfil actualizado con éxito!');
        if (newAvatarUrl) {
            avatarPreview.src = `${newAvatarUrl}?t=${new Date().getTime()}`;
        }

    } catch (error) {
        showNotification(`Error al actualizar: ${error.message}`, true);
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
            avatarPreview.src = e.target.result;
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
