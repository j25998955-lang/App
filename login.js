import { supabase } from './supabase-client.js';

// Hacemos las funciones principales accesibles globalmente asignándolas a 'window'
// para que el HTML pueda llamarlas directamente desde el atributo 'onsubmit'.

// --- FUNCIÓN GLOBAL PARA MANEJAR EL INICIO DE SESIÓN ---
window.handleLogin = async (event) => {
    event.preventDefault(); // Prevenir que la página se recargue
    const form = event.target;
    clearError(form);
    showError(form, "Procesando inicio de sesión..."); // Mensaje de feedback inmediato

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        showError(form, `Error: ${error.message}`);
    } else {
        clearError(form);
        window.location.href = 'wall.html'; // ¡Éxito! Redirigir al muro
    }
};

// --- FUNCIÓN GLOBAL PARA MANEJAR EL REGISTRO ---
window.handleRegister = async (event) => {
    event.preventDefault();
    const form = event.target;
    clearError(form);
    showError(form, "Procesando registro...");

    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    const { data: { user }, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
        showError(form, `Error en el registro: ${signUpError.message}`);
        return;
    }

    if (user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ id: user.id, username: email.split('@')[0] }]);

        if (profileError) {
            showError(form, `Registro exitoso, pero no se pudo crear el perfil: ${profileError.message}`);
        } else {
            showError(form, '¡Registro completado! Revisa tu correo para verificar tu cuenta.');
            form.reset();
        }
    }
};

// --- MANEJO DE ERRORES (Función de ayuda) ---
const showError = (form, message) => {
    let errorDiv = form.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        form.prepend(errorDiv);
    }
    errorDiv.textContent = message;
};

const clearError = (form) => {
    const errorDiv = form.querySelector('.error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
};

// --- LÓGICA PARA CAMBIAR ENTRE FORMULARIOS ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const switchLink = document.getElementById('switch-link');
    const formTitle = document.getElementById('form-title');
    const switchText = document.getElementById('switch-text');

    if (switchLink) {
        switchLink.addEventListener('click', (e) => {
            e.preventDefault();
            const isLogin = loginForm.style.display !== 'none';
            if (isLogin) {
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
                formTitle.textContent = 'Crear Cuenta en Askboys';
                switchText.textContent = '¿Ya tienes una cuenta?';
                switchLink.textContent = 'Inicia Sesión';
            } else {
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
                formTitle.textContent = 'Iniciar Sesión en Askboys';
                switchText.textContent = '¿No tienes una cuenta?';
                switchLink.textContent = 'Regístrate';
            }
        });
    }
});
