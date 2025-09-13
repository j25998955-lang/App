import { supabase } from './supabase-client.js';

// --- ELEMENTOS DEL DOM ---
document.addEventListener('DOMContentLoaded', () => {
    const showLoginBtn = document.getElementById('show-login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    
    // Enlace para recuperar contraseña (lo añadiremos al HTML en el siguiente paso)
    const forgotPasswordLink = document.getElementById('forgot-password-link');

    // --- MANEJO DE PESTAÑAS ---
    showLoginBtn.addEventListener('click', () => {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        showLoginBtn.classList.add('active');
        showRegisterBtn.classList.remove('active');
    });

    showRegisterBtn.addEventListener('click', () => {
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        showRegisterBtn.classList.add('active');
        showLoginBtn.classList.remove('active');
    });

    // --- MOSTRAR/OCULTAR MENSAJES DE ERROR ---
    const showMessage = (area, message) => {
        area.textContent = message;
        area.classList.add('active');
    };

    const hideMessage = (area) => {
        area.textContent = '';
        area.classList.remove('active');
    };

    // --- LÓGICA DE INICIO DE SESIÓN ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessage(loginError);
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showMessage(loginError, `Error: ${error.message}`);
        } else {
            window.location.href = 'wall.html';
        }
    });

    // --- LÓGICA DE REGISTRO ---
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessage(registerError);
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        // Validar que el nombre de usuario no esté vacío
        if (!username) {
            showMessage(registerError, 'El nombre de usuario es obligatorio.');
            return;
        }

        const { data: { user }, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username }, // Guardar el nombre de usuario en los metadatos
            },
        });

        if (error) {
            showMessage(registerError, `Error: ${error.message}`);
        } else if (user) {
            // Crear el perfil del usuario después del registro exitoso
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    { 
                        id: user.id, 
                        username: username, 
                        avatar_url: `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(username)}`
                    }
                ]);

            if (profileError) {
                showMessage(registerError, `Registro exitoso, pero hubo un error al crear tu perfil: ${profileError.message}. Por favor, actualízalo más tarde.`);
            } else {
                 showMessage(registerError, '¡Registro exitoso! Revisa tu correo para activar tu cuenta antes de iniciar sesión.');
                 registerForm.reset();
            }           
        }
    });
    
    // --- LÓGICA DE OLVIDÉ MI CONTRASEÑA ---
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (event) => {
            event.preventDefault();
            hideMessage(loginError);
            const email = document.getElementById('login-email').value;

            if (!email) {
                showMessage(loginError, 'Por favor, introduce tu email arriba y haz clic de nuevo en el enlace.');
                return;
            }

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin, // URL a la que volverá el usuario
            });

            if (error) {
                showMessage(loginError, `Error: ${error.message}`);
            } else {
                showMessage(loginError, 'Te hemos enviado un enlace para recuperar tu contraseña. Revisa tu correo.');
            }
        });
    }
});
